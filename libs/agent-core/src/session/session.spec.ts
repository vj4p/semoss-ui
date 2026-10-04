/**
 * The session: what the console does with a prompt, a poll, a stop and a
 * decision, and what it says when one of them fails.
 *
 * The agent is faked at exactly the seam the session uses - `watch`, `done`,
 * `stop`, `cancel`, `decide`, `pokeNow` - so a test decides when each poll
 * lands, and can deliver what a live backend rarely produces on cue: a
 * reconcile that fails, a stop that races the run's end, polling that just
 * stops. Items are still folded by the SDK's own reducer, as `AgentStore.watch`
 * folds them, and the run still goes through the real `watchAgentRun`.
 */

import { describe, expect, it, vi } from "vitest";
import type {
	AgentRunItem,
	AgentRunItemEvent,
	AgentRunSnapshot,
	AgentStore,
	PendingAgentAction,
} from "@semoss/sdk";
import {
	applyAgentRunItemEvent,
	createAgentRunItemsState,
} from "../../../sdk/src/stores/agent/agent.store";
import type { AgentWatchHandlers } from "../run/run-registry";
import { type Line, textLine } from "../transcript/line";
import type { RunEntry, RunProgress, SubagentRun } from "./entries";
import { entryLines } from "./run-lines";
import {
	activeRunEntry,
	createSession,
	currentHarness,
	currentModel,
	EXPORT_EVENT_LIMIT,
	keyedApproval,
	MAX_FOLLOWED_SUBAGENTS,
	MAX_SUBAGENT_DEPTH,
	type RunExport,
	type RunRequest,
	type Session,
	type SessionBackend,
	type SessionCatalog,
	type SessionOptions,
	type SessionState,
	waitingActions,
} from "./session";

const CATALOG: SessionCatalog = {
	harnesses: [
		{ name: "claude_code", label: "Claude Code" },
		{ name: "semoss", label: "SEMOSS", isDefault: true },
	],
	models: [
		{ id: "model-1", name: "GPT-5" },
		{ id: "model-2", name: "Qwen 3.5" },
	],
};

const PROMPT = "Find the flaky test";
const TIMESTAMP = "2026-09-23T08:00:00.000Z";

const deferred = <T>() => {
	let resolve: (value: T) => void = () => undefined;
	let reject: (reason: unknown) => void = () => undefined;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

/** Let everything the session chained run: a room created, a run started, `done` observed. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const message = (id: string, text: string): AgentRunItem => ({
	id,
	kind: "message",
	role: "assistant",
	text,
});

const tool = (id: string, title: string): AgentRunItem => ({
	id,
	kind: "tool",
	name: "Bash",
	title,
	arguments: {},
	status: "INPUT_REQUIRED",
});

const action = (
	overrides: Partial<PendingAgentAction> = {},
): PendingAgentAction => ({
	actionId: "action-1",
	runId: "run-1",
	parentMessageId: null,
	toolCallId: null,
	toolName: "Bash",
	toolArgs: {},
	editedArgs: null,
	toolMeta: null,
	hasUi: false,
	uiUrl: null,
	status: "PENDING",
	...overrides,
});

let runCount = 0;
let eventCount = 0;

/**
 * A stand-in for one AgentStore, driven by the test.
 *
 * It keeps the two behaviours of the real store the session depends on.
 * `done` reads as already settled until `watch` is called, and `stop` settles
 * it. Run ids are unique across the file because the run registry is
 * module-level. A subagent's store is given the run id its parent's item
 * names.
 */
const fakeAgent = (roomId = "room-new", runId = `run-${++runCount}`) => {
	let handlers: AgentWatchHandlers | undefined;
	let done: Promise<AgentRunSnapshot | null> | undefined;
	let finish: (snapshot: AgentRunSnapshot | null) => void = () => undefined;
	let items = createAgentRunItemsState();
	let last: AgentRunSnapshot | null = null;

	const snapshotOf = (
		partial: Partial<AgentRunSnapshot>,
	): AgentRunSnapshot => ({
		runId,
		roomId,
		status: "RUNNING",
		pendingActions: [],
		...partial,
	});

	const stop = vi.fn(() => finish(last));
	const pokeNow = vi.fn();
	const fake = {
		runId,
		roomId,
		insightId: "insight-1",
		get done() {
			return done ?? Promise.resolve(null);
		},
		watch: vi.fn((given: AgentWatchHandlers) => {
			handlers ??= given;
			done ??= new Promise((resolve) => {
				finish = resolve;
			});
			return { stop, getItems: () => items, pokeNow, done };
		}),
		stop,
		pokeNow,
		cancel: vi.fn(
			async (): Promise<AgentRunSnapshot> =>
				snapshotOf({ status: "CANCELLED" }),
		),
		decide: vi.fn(
			async (
				_action: PendingAgentAction,
				_decision: "submit" | "reject" | "respond",
				_paramValues?: Record<string, unknown>,
			): Promise<string> => "decided",
		),
	};

	const watching = () => {
		if (handlers === undefined) {
			throw new Error(`${runId} is not being watched`);
		}
		return handlers;
	};

	const nextEvent = () => ({
		version: 1 as const,
		eventId: `event-${++eventCount}`,
		sequence: eventCount,
		runId,
		timestamp: TIMESTAMP,
	});

	return {
		runId,
		agent: fake as unknown as AgentStore,
		fake,
		started: (item: AgentRunItem): AgentRunItemEvent => ({
			...nextEvent(),
			type: "item.started",
			item,
		}),
		delta: (itemId: string, text: string): AgentRunItemEvent => ({
			...nextEvent(),
			type: "item.updated",
			itemId,
			kind: "message",
			delta: text,
		}),
		/** A tool begun, as the semoss harness says so, just before it runs. */
		running: (itemId: string): AgentRunItemEvent => ({
			...nextEvent(),
			type: "item.updated",
			itemId,
			kind: "tool",
			patch: { status: "RUNNING" },
		}),
		/** A subagent's item changed, as its parent's feed reports it. */
		patched: (
			itemId: string,
			patch: Record<string, unknown>,
		): AgentRunItemEvent => ({
			...nextEvent(),
			type: "item.updated",
			itemId,
			kind: "subagent",
			patch,
		}),
		/** One poll, as `watch` delivers it: each event folded, then the snapshot. */
		poll: (
			partial: Partial<AgentRunSnapshot> = {},
			events: readonly AgentRunItemEvent[] = [],
			droppedEvents = 0,
		) => {
			const on = watching();
			for (const event of events) {
				items = applyAgentRunItemEvent(items, event);
				on.onEvent(event, items);
			}
			last = snapshotOf(partial);
			on.onSnapshot(last, { droppedEvents });
		},
		reconcile: (partial: Partial<AgentRunSnapshot> = {}) => {
			last = snapshotOf(partial);
			watching().onReconcile(last);
		},
		fail: (error: Error) => watching().onError?.(error),
		/** Polling ends without a reconcile saying the run is over, as the failure cap's can. */
		endPolling: () => finish(last),
	};
};

type FakeRun = ReturnType<typeof fakeAgent>;

const setup = ({
	backend: overrides,
	...options
}: Partial<Omit<SessionOptions, "backend">> & {
	backend?: Partial<SessionBackend>;
} = {}) => {
	const runs: FakeRun[] = [];
	const backend = {
		createRoom: vi.fn(async (): Promise<string> => "room-new"),
		updateRoom: vi.fn(async (): Promise<void> => undefined),
		startRun: vi.fn(async (request: RunRequest) => {
			const run = fakeAgent(request.roomId);
			runs.push(run);
			return run.agent;
		}),
		fetchMCPTools: vi.fn(async () => []),
		setRoomMCPTools: vi.fn(async () => undefined),
		getRoomMCPTools: vi.fn(async () => []),
		...overrides,
	};
	const session = createSession({
		backend,
		catalog: CATALOG,
		now: () => 1000,
		...options,
	});
	const latest = () => {
		const run = runs.at(-1);
		if (run === undefined) {
			throw new Error("no run has started");
		}
		return run;
	};
	return { session, backend, latest };
};

const start = async (session: Session, prompt = PROMPT) => {
	const result = await session.submit(prompt);
	await settle();
	return result;
};

/** A line as the words on screen. */
const plain = (line: Line): string => {
	switch (line.kind) {
		case "prompt":
		case "reasoning":
			return line.text;
		case "text":
			return line.segments.map((segment) => segment.text).join("");
		case "divider":
			return line.label ?? "";
		case "tool":
		case "subagent":
			return line.label;
	}
};

const screen = (session: Session) =>
	session
		.getState()
		.entries.flatMap((entry) => entryLines(entry, session.translate))
		.map(plain);

const notices = (session: Session) =>
	session
		.getState()
		.entries.flatMap((entry) =>
			entry.kind === "notice" ? entry.lines : [],
		)
		.map(plain);

const lastRun = (session: Session): RunEntry => {
	const run = session
		.getState()
		.entries.filter((entry): entry is RunEntry => entry.kind === "run")
		.at(-1);
	if (run === undefined) {
		throw new Error("no run entry");
	}
	return run;
};

describe("a new session", () => {
	it("starts on the room's harness, else the catalog's default, else its first", () => {
		expect(
			setup({ harness: "claude_code" }).session.getState().harness,
		).toBe("claude_code");
		expect(setup({ harness: "retired" }).session.getState().harness).toBe(
			"semoss",
		);
		const noDefault = {
			...CATALOG,
			harnesses: [
				{ name: "a", label: "A" },
				{ name: "b", label: "B" },
			],
		};
		expect(setup({ catalog: noDefault }).session.getState().harness).toBe(
			"a",
		);
	});

	it("starts on the first preferred model the catalog still has", () => {
		expect(
			setup({
				preferredModels: [undefined, "deleted", "model-2"],
			}).session.getState().modelId,
		).toBe("model-2");
		expect(
			setup({ preferredModels: ["deleted"] }).session.getState().modelId,
		).toBe("model-1");
	});

	it("shows a reopened room's history as history, not as a notice", () => {
		const history: Line[] = [{ kind: "prompt", text: "Earlier" }];
		expect(setup({ history }).session.getState().entries).toEqual([
			{ kind: "history", id: expect.any(String), lines: history },
		]);
		expect(setup({ history: [] }).session.getState().entries).toEqual([]);
	});

	it("refuses a prompt when there is no model to run it on", async () => {
		const { session, backend } = setup({
			catalog: { harnesses: CATALOG.harnesses, models: [] },
		});
		expect(session.getState().modelId).toBeUndefined();
		expect(await session.submit(PROMPT)).toEqual({ kind: "refused" });
		expect(notices(session)).toEqual([
			"No model is available. A model appears here once it is tagged text-generation.",
		]);
		expect(backend.createRoom).not.toHaveBeenCalled();
	});

	it("refuses a prompt when there is no harness to run it with", async () => {
		const { session } = setup({
			catalog: { harnesses: [], models: CATALOG.models },
		});
		expect(await session.submit(PROMPT)).toEqual({ kind: "refused" });
		expect(notices(session)).toEqual(["No agent harness is available."]);
	});
});

describe("running a prompt", () => {
	it("creates the room with the first prompt, once, and reports it", async () => {
		const onRoomChange = vi.fn();
		const { session, backend, latest } = setup({ host: { onRoomChange } });

		expect(await start(session, `  ${PROMPT}  `)).toEqual({
			kind: "started",
			entryId: expect.any(String),
		});
		expect(backend.createRoom).toHaveBeenCalledWith({
			harness: "semoss",
			modelId: "model-1",
		});
		expect(onRoomChange).toHaveBeenCalledWith("room-new");
		expect(backend.startRun).toHaveBeenCalledWith({
			harness: "semoss",
			modelId: "model-1",
			roomId: "room-new",
			command: PROMPT,
		});
		expect(session.getState().roomId).toBe("room-new");

		latest().reconcile({ status: "COMPLETED" });
		await start(session, "And the next one");
		expect(backend.createRoom).toHaveBeenCalledTimes(1);
		expect(backend.startRun).toHaveBeenLastCalledWith(
			expect.objectContaining({
				roomId: "room-new",
				command: "And the next one",
			}),
		);
	});

	it("continues the room it was opened on", async () => {
		const { session, backend } = setup({ roomId: "room-1" });
		await start(session);
		expect(backend.createRoom).not.toHaveBeenCalled();
		expect(backend.startRun).toHaveBeenCalledWith(
			expect.objectContaining({ roomId: "room-1" }),
		);
	});

	it("shows the run at once, before the backend has accepted it", async () => {
		const accepted = deferred<AgentStore>();
		const { session } = setup({
			roomId: "room-1",
			backend: { startRun: vi.fn(() => accepted.promise) },
		});
		const result = await start(session);

		const state = session.getState();
		expect(result).toEqual({
			kind: "started",
			entryId: state.activeEntryId,
		});
		expect(activeRunEntry(state)).toMatchObject({
			status: "STARTING",
			prompt: PROMPT,
			harness: "semoss",
			modelId: "model-1",
		});
		expect(activeRunEntry(state)?.runId).toBeUndefined();
	});

	it("refuses a prompt while a run is in progress, and says why", async () => {
		const { session, backend } = setup();
		await start(session);
		expect(await session.submit("Another thing")).toEqual({
			kind: "refused",
		});
		expect(notices(session)).toEqual([
			"A run is in progress. Wait for it to finish, or type :stop.",
		]);
		expect(backend.startRun).toHaveBeenCalledTimes(1);
	});

	it("sends a prompt typed with two leading colons as text", async () => {
		const { session, backend } = setup();
		await start(session, "::help is a word here");
		expect(backend.startRun).toHaveBeenCalledWith(
			expect.objectContaining({ command: ":help is a word here" }),
		);
		expect(session.getState().entries.map((entry) => entry.kind)).toEqual([
			"run",
		]);
	});

	it("folds the run's events and polls into its entry", async () => {
		const { session, latest } = setup();
		await start(session);
		const run = latest();
		expect(lastRun(session)).toMatchObject({
			runId: run.runId,
			status: "SUBMITTED",
		});

		run.poll(
			{ status: "RUNNING" },
			[run.started(message("m1", "Look")), run.delta("m1", "ing.")],
			3,
		);
		run.poll({ status: "RUNNING" }, [], 2);

		// Each poll reports the events evicted since the last one, so the
		// session keeps the sum.
		expect(lastRun(session)).toMatchObject({
			status: "RUNNING",
			droppedEvents: 5,
		});
		expect(screen(session)).toEqual([
			PROMPT,
			"Looking.",
			"Earlier events were dropped from the live feed (5).",
		]);
	});

	it("does not redraw for a poll that brought nothing new", async () => {
		const { session, latest } = setup();
		session.notice([textLine("before the run")]);
		await start(session);
		const run = latest();
		const [notice] = session.getState().entries;

		run.poll({ status: "RUNNING" }, [run.started(message("m1", "Hi"))]);
		// An update replaces the run's entry and nothing else.
		expect(session.getState().entries[0]).toBe(notice);

		const before = session.getState();
		const listener = vi.fn();
		session.subscribe(listener);
		run.poll({ status: "RUNNING" });
		expect(listener).not.toHaveBeenCalled();
		expect(session.getState()).toBe(before);
	});

	it("ends the run on a reconcile that says it is over, and frees the prompt", async () => {
		const { session, latest } = setup();
		await start(session);
		const run = latest();
		run.reconcile({ status: "COMPLETED", finalText: "Found it." });
		await settle();

		expect(session.getState().activeEntryId).toBeUndefined();
		expect(lastRun(session)).toMatchObject({
			status: "COMPLETED",
			endedAt: 1000,
		});
		// The events that carried the answer never arrived, so it comes from
		// the durable snapshot instead.
		expect(screen(session)).toEqual([PROMPT, "Found it."]);
		expect(run.fake.stop).toHaveBeenCalled();
		expect((await start(session, "Next")).kind).toBe("started");
	});

	it("ends a failed run with the backend's reason", async () => {
		// `watchAgentRun` rejects here. Were that rejection unhandled, vitest
		// would fail the run.
		const { session, latest } = setup();
		await start(session);
		latest().reconcile({
			status: "FAILED",
			errorMessage: "model is required",
		});
		await settle();
		expect(session.getState().activeEntryId).toBeUndefined();
		expect(screen(session).at(-1)).toBe("Run failed: model is required");
	});

	it("clears what was waiting when the run ends", async () => {
		const { session, latest } = setup();
		await start(session);
		const bash = action();
		latest().poll({ status: "INPUT_REQUIRED", pendingActions: [bash] });
		latest().reconcile({ status: "CANCELLED", pendingActions: [bash] });
		expect(lastRun(session).pendingActions).toEqual([]);
	});

	it("says when a poll fails, until one gets through", async () => {
		const { session, latest } = setup();
		await start(session);
		const run = latest();
		run.fail(new Error("Network down"));
		expect(screen(session).at(-1)).toBe(
			"Cannot reach the server. Retrying… (Network down)",
		);
		run.poll({ status: "RUNNING" });
		expect(lastRun(session).transportError).toBeUndefined();
	});

	describe("a run the console loses", () => {
		it("is LOST when polling stops without saying the run is over", async () => {
			const { session, latest } = setup();
			await start(session);
			const run = latest();
			run.poll({ status: "RUNNING" });
			run.fail(new Error("Network down"));
			run.endPolling();
			await settle();

			expect(session.getState().activeEntryId).toBeUndefined();
			expect(lastRun(session)).toMatchObject({
				status: "LOST",
				endedAt: 1000,
				transportError: undefined,
			});
			expect(screen(session).at(-1)).toBe(
				"Lost contact with this run. It may still be running on the server.",
			);
		});

		it("is LOST when the last reconcile found the run still going", async () => {
			const { session, latest } = setup();
			await start(session);
			const run = latest();
			run.reconcile({ status: "RUNNING" });
			run.endPolling();
			await settle();
			expect(lastRun(session).status).toBe("LOST");
		});

		it("keeps a final status a poll reported, when the reconcile after it failed", async () => {
			const { session, latest } = setup();
			await start(session);
			const run = latest();
			run.poll({ status: "COMPLETED", finalText: "Found it." });
			run.fail(new Error("Reconcile failed"));
			run.endPolling();
			await settle();

			expect(session.getState().activeEntryId).toBeUndefined();
			expect(lastRun(session)).toMatchObject({
				status: "COMPLETED",
				transportError: undefined,
			});
			expect(screen(session)).toEqual([PROMPT, "Found it."]);
		});
	});

	describe("a run that never starts", () => {
		it("says why the backend refused it", async () => {
			const { session } = setup({
				roomId: "room-1",
				backend: {
					startRun: vi.fn(async (): Promise<AgentStore> => {
						throw new Error("Model engine is required");
					}),
				},
			});
			await start(session);
			expect(session.getState().activeEntryId).toBeUndefined();
			expect(lastRun(session)).toMatchObject({
				status: "FAILED",
				startError: "Model engine is required",
				endedAt: 1000,
			});
			expect(screen(session).at(-1)).toBe(
				"Could not start the run: Model engine is required",
			);
		});

		it("says why the room could not be created, and sends no run", async () => {
			const onRoomChange = vi.fn();
			const { session, backend } = setup({
				backend: {
					createRoom: vi.fn(async (): Promise<string> => {
						throw "Not allowed";
					}),
				},
				host: { onRoomChange },
			});
			await start(session);
			expect(backend.startRun).not.toHaveBeenCalled();
			expect(onRoomChange).not.toHaveBeenCalled();
			expect(session.getState().roomId).toBeUndefined();
			expect(screen(session).at(-1)).toBe(
				"Could not start the run: Not allowed",
			);
		});
	});
});

describe("timing a running tool", () => {
	/**
	 * A call as the backend first shows it: QUEUED from the semoss harness,
	 * which patches it RUNNING later, and RUNNING from claude_code.
	 */
	const bash = (id: string, status: "QUEUED" | "RUNNING"): AgentRunItem => ({
		id,
		kind: "tool",
		name: "Bash",
		arguments: {},
		status,
	});

	it("notes when a tool was first drawn running, and keeps that time", async () => {
		let clock = 1_000;
		const { session, latest } = setup({ now: () => clock });
		await start(session);
		const run = latest();

		clock = 2_000;
		run.poll({ status: "RUNNING" }, [run.started(bash("t1", "QUEUED"))]);
		expect(lastRun(session).runningSince).toEqual({});

		clock = 3_000;
		run.poll({ status: "RUNNING" }, [run.running("t1")]);
		expect(lastRun(session).runningSince).toEqual({ t1: 3_000 });
		expect(
			entryLines(lastRun(session)).find((line) => line.kind === "tool"),
		).toMatchObject({ status: "RUNNING", runningSince: 3_000 });

		// Nothing new, so nothing to redraw: the time stands, and so does
		// the state.
		const before = session.getState();
		clock = 4_000;
		run.poll({ status: "RUNNING" });
		expect(session.getState()).toBe(before);
		expect(lastRun(session).runningSince).toEqual({ t1: 3_000 });
	});

	it("notes a tool that starts out running, as claude_code's do", async () => {
		const { session, latest } = setup({ now: () => 5_000 });
		await start(session);
		const run = latest();
		run.poll({ status: "RUNNING" }, [run.started(bash("t1", "RUNNING"))]);
		expect(lastRun(session).runningSince).toEqual({ t1: 5_000 });
	});

	it("does not count a call waiting on the user", async () => {
		const { session, latest } = setup();
		await start(session);
		const run = latest();
		run.poll({ status: "RUNNING" }, [run.started(tool("t1", "Bash"))]);
		expect(lastRun(session).runningSince).toEqual({});
	});
});

describe("stopping", () => {
	it("stops the run, and polls at once to hear that it stopped", async () => {
		const { session, latest } = setup();
		await start(session);
		const run = latest();
		run.poll({ status: "RUNNING" });

		await session.interrupt();
		expect(run.fake.cancel).toHaveBeenCalledTimes(1);
		expect(run.fake.pokeNow).toHaveBeenCalled();
		expect(screen(session).at(-1)).toBe("Stopping…");

		run.reconcile({ status: "CANCELLED" });
		expect(screen(session).at(-1)).toBe("Run cancelled.");
	});

	it("stops a run as soon as the backend has it, when asked before", async () => {
		const accepted = deferred<AgentStore>();
		const { session } = setup({
			roomId: "room-1",
			backend: { startRun: vi.fn(() => accepted.promise) },
		});
		await start(session);
		await session.interrupt();
		expect(lastRun(session)).toMatchObject({
			status: "STARTING",
			stopRequested: true,
		});

		const run = fakeAgent("room-1");
		accepted.resolve(run.agent);
		await settle();
		expect(run.fake.cancel).toHaveBeenCalledTimes(1);
	});

	it("sends one stop, however often it is asked for", async () => {
		const { session, latest } = setup();
		await start(session);
		const run = latest();
		const stopped = deferred<AgentRunSnapshot>();
		run.fake.cancel.mockReturnValueOnce(stopped.promise);

		const first = session.interrupt();
		await session.interrupt();
		stopped.resolve({
			runId: run.runId,
			roomId: "room-new",
			status: "CANCELLED",
			pendingActions: [],
		});
		await first;
		expect(run.fake.cancel).toHaveBeenCalledTimes(1);
	});

	it("says when nothing is running", async () => {
		const { session } = setup();
		await session.interrupt();
		expect(notices(session)).toEqual(["Nothing is running."]);
	});

	it("has nothing to stop once the run's status is final", async () => {
		const { session, latest } = setup();
		await start(session);
		const run = latest();
		// Final, but its last events are still draining.
		run.poll({ status: "COMPLETED" }, [
			run.started(message("m1", "Done.")),
		]);

		await session.interrupt();
		expect(run.fake.cancel).not.toHaveBeenCalled();
		expect(notices(session)).toEqual(["Nothing is running."]);
		// It holds the prompt until the drain ends all the same.
		expect(await session.submit("Next")).toEqual({ kind: "refused" });
	});

	it("says a stop failed, and takes the stopping line back", async () => {
		const { session, latest } = setup();
		await start(session);
		const run = latest();
		run.fake.cancel.mockRejectedValueOnce(new Error("Forbidden"));

		await session.interrupt();
		expect(lastRun(session).stopRequested).toBe(false);
		expect(notices(session)).toEqual(["Could not stop the run: Forbidden"]);
		expect(screen(session)).not.toContain("Stopping…");
	});

	it("says nothing of a stop that failed because the run ended first", async () => {
		const { session, latest } = setup();
		await start(session);
		const run = latest();
		run.fake.cancel.mockImplementationOnce(async () => {
			run.reconcile({ status: "COMPLETED" });
			throw new Error("Run is not active");
		});

		await session.interrupt();
		expect(notices(session)).toEqual([]);
		expect(lastRun(session).status).toBe("COMPLETED");
	});
});

describe("decisions", () => {
	const bash = action({
		actionId: "a-bash",
		toolCallId: "t1",
		toolName: "Bash",
	});
	const question = action({
		actionId: "a-question",
		toolName: "RequestUserInput",
	});

	/** A session whose run is waiting on `pending`. */
	const waitingOn = async (...pending: PendingAgentAction[]) => {
		const { session, latest } = setup();
		await start(session);
		const run = latest();
		run.poll({ status: "INPUT_REQUIRED", pendingActions: pending }, [
			run.started(tool("t1", "Run a command")),
		]);
		return { session, run };
	};

	it("approves the first call waiting, and hides it before the backend answers", async () => {
		const { session, run } = await waitingOn(bash);
		const decided = deferred<string>();
		run.fake.decide.mockReturnValueOnce(decided.promise);

		const approving = session.approve();
		expect(lastRun(session).pendingActions).toEqual([]);
		decided.resolve("decided");

		expect(await approving).toBe(true);
		expect(run.fake.decide).toHaveBeenCalledWith(bash, "submit", undefined);
		expect(notices(session)).toEqual(["Approved Run a command."]);
	});

	it("keeps a decided call hidden while the backend still reports it", async () => {
		const { session, run } = await waitingOn(bash);
		await session.approve();
		run.poll({ status: "INPUT_REQUIRED", pendingActions: [bash] });
		expect(lastRun(session).pendingActions).toEqual([]);
	});

	it("offers the call again when the decision does not reach the backend", async () => {
		const { session, run } = await waitingOn(bash);
		run.fake.decide.mockRejectedValueOnce(
			new Error("Action already decided"),
		);

		expect(await session.approve()).toBe(false);
		expect(lastRun(session).pendingActions).toEqual([bash]);
		expect(notices(session)).toEqual([
			"Could not send the decision: Action already decided",
		]);
	});

	it("sends a question to its form rather than approving it", async () => {
		const { session, run } = await waitingOn(question);
		expect(await session.approve()).toBe(false);
		expect(run.fake.decide).not.toHaveBeenCalled();
		expect(notices(session)).toEqual([
			"The agent asked a question. Answer it in the form, or type :deny to dismiss it.",
		]);
	});

	it("approves a call waiting behind a question", async () => {
		const { session, run } = await waitingOn(question, bash);
		await session.approve();
		expect(run.fake.decide).toHaveBeenCalledWith(bash, "submit", undefined);
		expect(lastRun(session).pendingActions).toEqual([question]);
	});

	it("denies the first call waiting, question or not", async () => {
		const { session, run } = await waitingOn(question, bash);
		expect(await session.deny()).toBe(true);
		expect(run.fake.decide).toHaveBeenCalledWith(
			question,
			"reject",
			undefined,
		);
		expect(notices(session)).toEqual(["Denied RequestUserInput."]);
	});

	it("answers a question with what its form collected", async () => {
		const { session, run } = await waitingOn(question);
		expect(await session.respond(question, { q1: "yes" })).toBe(true);
		expect(run.fake.decide).toHaveBeenCalledWith(question, "respond", {
			q1: "yes",
		});
		expect(lastRun(session).pendingActions).toEqual([]);
	});

	it("refuses a decision on a call that is not waiting", async () => {
		const { session, run } = await waitingOn(question);
		expect(await session.respond(action({ actionId: "stale" }), {})).toBe(
			false,
		);
		expect(run.fake.decide).not.toHaveBeenCalled();
		expect(notices(session)).toEqual(["Nothing is waiting for approval."]);
	});

	it("shows a call the reconcile reports waiting", async () => {
		const { session, latest } = setup();
		await start(session);
		latest().poll({ status: "INPUT_REQUIRED" });
		latest().reconcile({
			status: "INPUT_REQUIRED",
			pendingActions: [bash],
		});
		expect(lastRun(session).pendingActions).toEqual([bash]);
		expect(session.getState().activeEntryId).toBeDefined();
	});

	it("says when nothing is waiting", async () => {
		const { session } = setup();
		expect(await session.approve()).toBe(false);
		expect(await session.deny()).toBe(false);
		await start(session);
		expect(await session.approve()).toBe(false);
		expect(notices(session)).toEqual([
			"Nothing is waiting for approval.",
			"Nothing is waiting for approval.",
			"Nothing is waiting for approval.",
		]);
	});
});

describe("switching", () => {
	it("switches harness by name or label, ignoring case, and saves the room", async () => {
		const { session, backend } = setup({ roomId: "room-1" });
		expect(await session.setHarness("claude code")).toBe(true);
		expect(session.getState().harness).toBe("claude_code");
		expect(backend.updateRoom).toHaveBeenLastCalledWith("room-1", {
			harness: "claude_code",
			modelId: "model-1",
		});

		expect(await session.setHarness(" SEMOSS ")).toBe(true);
		expect(session.getState().harness).toBe("semoss");
		expect(screen(session)).toEqual([
			"harness → Claude Code",
			"harness → SEMOSS",
		]);
	});

	it("says which harness it does not know", async () => {
		const { session, backend } = setup({ roomId: "room-1" });
		expect(await session.setHarness("Codex")).toBe(false);
		expect(notices(session)).toEqual([
			'No harness named "Codex". Type :harness to list them.',
		]);
		expect(backend.updateRoom).not.toHaveBeenCalled();
	});

	it("does nothing when asked for the harness it is on", async () => {
		const { session, backend } = setup({ roomId: "room-1" });
		expect(await session.setHarness("semoss")).toBe(true);
		expect(session.getState().entries).toEqual([]);
		expect(backend.updateRoom).not.toHaveBeenCalled();
	});

	it("has no room to save to before the first prompt, which then carries the switch", async () => {
		const { session, backend } = setup();
		await session.setHarness("claude_code");
		expect(backend.updateRoom).not.toHaveBeenCalled();
		await start(session);
		expect(backend.createRoom).toHaveBeenCalledWith({
			harness: "claude_code",
			modelId: "model-1",
		});
	});

	it("keeps a switch the room could not save, and says so", async () => {
		const { session } = setup({
			roomId: "room-1",
			backend: {
				updateRoom: vi.fn(async (): Promise<void> => {
					throw new Error("Forbidden");
				}),
			},
		});
		expect(await session.setModel("model-2")).toBe(true);
		expect(session.getState().modelId).toBe("model-2");
		expect(screen(session)).toEqual([
			"model → Qwen 3.5",
			"Could not save the room settings: Forbidden",
		]);
	});

	it("saves one switch at a time, and the last save carries the last switch", async () => {
		const saved = deferred<void>();
		const updateRoom = vi
			.fn(async (): Promise<void> => undefined)
			.mockReturnValueOnce(saved.promise);
		const { session } = setup({
			roomId: "room-1",
			backend: { updateRoom },
		});

		const first = session.setHarness("claude_code");
		const second = session.setModel("model-2");
		await settle();
		expect(updateRoom).toHaveBeenCalledTimes(1);

		saved.resolve();
		await Promise.all([first, second]);
		expect(updateRoom).toHaveBeenCalledTimes(2);
		expect(updateRoom).toHaveBeenLastCalledWith("room-1", {
			harness: "claude_code",
			modelId: "model-2",
		});
	});

	it("refuses to switch while a run is in progress", async () => {
		const { session } = setup();
		await start(session);
		expect(await session.setHarness("claude_code")).toBe(false);
		expect(await session.setModel("model-2")).toBe(false);
		expect(session.getState()).toMatchObject({
			harness: "semoss",
			modelId: "model-1",
		});
	});

	it("cycles through the harnesses, wrapping round", async () => {
		const { session } = setup();
		await session.cycleHarness();
		expect(session.getState().harness).toBe("claude_code");
		await session.cycleHarness();
		expect(session.getState().harness).toBe("semoss");
	});

	it("has nothing to cycle to with a single harness", async () => {
		const { session } = setup({
			catalog: {
				...CATALOG,
				harnesses: [{ name: "semoss", label: "SEMOSS" }],
			},
		});
		expect(await session.cycleHarness()).toBe(false);
		expect(session.getState().entries).toEqual([]);
	});

	it("switches model by id, or by name ignoring case", async () => {
		const { session } = setup();
		expect(await session.setModel("model-2")).toBe(true);
		expect(await session.setModel("gpt-5")).toBe(true);
		expect(session.getState().modelId).toBe("model-1");
		expect(await session.setModel("Llama")).toBe(false);
		expect(screen(session)).toEqual([
			"model → Qwen 3.5",
			"model → GPT-5",
			'No model named "Llama". Type :model to list them.',
		]);
	});
});

describe("rooms and the screen", () => {
	it("leaves the room for a new one, which the next prompt creates", async () => {
		const onRoomChange = vi.fn();
		const { session, backend } = setup({
			roomId: "room-1",
			history: [{ kind: "prompt", text: "Earlier" }],
			host: { onRoomChange },
		});
		expect(session.newRoom()).toBe(true);
		expect(session.getState().roomId).toBeUndefined();
		expect(onRoomChange).toHaveBeenCalledWith(undefined);
		expect(screen(session)).toEqual([
			"New room. It is saved when you send the first prompt.",
		]);

		await start(session);
		expect(backend.createRoom).toHaveBeenCalledTimes(1);
	});

	it("will not leave the room during a run", async () => {
		const { session } = setup();
		await start(session);
		expect(session.newRoom()).toBe(false);
		expect(session.getState().roomId).toBe("room-new");
	});

	it("clears the screen, but keeps the run in progress", async () => {
		const { session } = setup({
			history: [{ kind: "prompt", text: "Earlier" }],
		});
		session.notice([textLine("A notice")]);
		await start(session);
		session.clear();
		expect(session.getState().entries.map((entry) => entry.kind)).toEqual([
			"run",
		]);
	});

	it("clears everything when nothing is running", () => {
		const { session } = setup({
			history: [{ kind: "prompt", text: "Earlier" }],
		});
		session.clear();
		expect(session.getState().entries).toEqual([]);
	});

	it("tells a subscriber about each change until it unsubscribes", () => {
		const { session } = setup();
		const listener = vi.fn();
		const unsubscribe = session.subscribe(listener);
		session.notice([textLine("one")]);
		unsubscribe();
		session.notice([textLine("two")]);
		expect(listener).toHaveBeenCalledTimes(1);
	});
});

describe("commands", () => {
	it("echoes a command, then runs it", async () => {
		const { session } = setup();
		expect(await session.submit(" :harness claude_code ")).toEqual({
			kind: "ran",
			name: "harness",
		});
		expect(session.getState().entries.map((entry) => entry.kind)).toEqual([
			"input",
			"notice",
		]);
		expect(screen(session)).toEqual([
			":harness claude_code",
			"harness → Claude Code",
		]);
	});

	it("shows why a command did not run", async () => {
		const { session } = setup();
		const message = "Unknown command :xyzzy. Type :help to list commands.";
		expect(await session.submit(":xyzzy")).toEqual({
			kind: "error",
			message,
		});
		expect(session.getState().entries.at(-1)).toMatchObject({
			kind: "notice",
			lines: [
				{
					kind: "text",
					segments: [{ text: message, emphasis: "error" }],
				},
			],
		});
	});

	it("runs a command by its alias", async () => {
		const { session } = setup();
		expect(await session.submit(":allow")).toEqual({
			kind: "ran",
			name: "approve",
		});
		expect(notices(session)).toEqual(["Nothing is waiting for approval."]);
	});

	it("runs the host's own commands, listed after the built-in ones", async () => {
		const run = vi.fn();
		const { session } = setup({
			commands: [
				{
					name: "ping",
					args: [{ name: "when", optional: true }],
					describe: "command.help",
					run,
				},
			],
		});
		expect(session.commands.commands.at(-1)?.name).toBe("ping");
		expect(await session.submit(":ping now")).toEqual({
			kind: "ran",
			name: "ping",
		});
		expect(run).toHaveBeenCalledWith(session, {
			args: ["now"],
			rest: "now",
		});
	});

	it("will not let a host command take a built-in's name", () => {
		expect(() =>
			setup({
				commands: [
					{
						name: "stop",
						describe: "command.stop",
						run: () => undefined,
					},
				],
			}),
		).toThrow('command name ":stop" is registered twice');
	});

	it("says it all through the host's translation", async () => {
		const { session } = setup({ translate: (key) => `[${key}]` });
		await session.submit(":stop");
		expect(screen(session)).toEqual([":stop", "[session.nothingRunning]"]);
	});
});

describe("exporting a run", () => {
	it("exports the last run's events as they were delivered", async () => {
		const saveExport = vi.fn((_data: RunExport) => undefined);
		const { session, latest } = setup({ host: { saveExport } });
		await start(session);
		const run = latest();
		const events = [
			run.started(message("m1", "Hel")),
			run.delta("m1", "lo"),
		];
		run.poll({ status: "RUNNING" }, events, 2);
		run.reconcile({ status: "COMPLETED", finalText: "Hello" });

		expect(await session.submit(":export")).toEqual({
			kind: "ran",
			name: "export",
		});
		expect(saveExport).toHaveBeenCalledWith({
			runId: run.runId,
			roomId: "room-new",
			harness: "semoss",
			modelId: "model-1",
			prompt: PROMPT,
			events,
			omittedEvents: 0,
			droppedEvents: 2,
			snapshot: expect.objectContaining({
				status: "COMPLETED",
				finalText: "Hello",
			}),
		});
		expect(notices(session)).toEqual([
			`Exported the events of run ${run.runId}.`,
		]);
	});

	it("keeps a bounded number of events, and counts the rest", async () => {
		const saveExport = vi.fn((_data: RunExport) => undefined);
		const { session, latest } = setup({ host: { saveExport } });
		await start(session);
		const run = latest();
		const events = [run.started(message("m1", ""))];
		for (let i = 0; i < EXPORT_EVENT_LIMIT; i++) {
			events.push(run.delta("m1", "x"));
		}
		run.poll({ status: "RUNNING" }, events);

		await session.exportLastRun();
		const data = saveExport.mock.lastCall?.[0];
		expect(data?.events).toHaveLength(EXPORT_EVENT_LIMIT);
		expect(data?.omittedEvents).toBe(1);
	});

	it("has nothing to export before a run, or after leaving the room", async () => {
		const saveExport = vi.fn();
		const { session, latest } = setup({ host: { saveExport } });
		await session.exportLastRun();
		await start(session);
		latest().reconcile({ status: "COMPLETED" });
		await settle();
		session.newRoom();
		await session.exportLastRun();

		expect(saveExport).not.toHaveBeenCalled();
		expect(notices(session)).toEqual([
			"New room. It is saved when you send the first prompt.",
			"No run to export yet.",
		]);
	});

	it("still exports the last run when the next one fails to start", async () => {
		const saveExport = vi.fn((_data: RunExport) => undefined);
		const first = fakeAgent();
		const startRun = vi
			.fn(async (): Promise<AgentStore> => {
				throw new Error("Busy");
			})
			.mockResolvedValueOnce(first.agent);
		const { session } = setup({
			backend: { startRun },
			host: { saveExport },
		});

		await start(session);
		first.reconcile({ status: "COMPLETED" });
		await start(session, "Next");
		expect(lastRun(session).startError).toBe("Busy");

		await session.exportLastRun();
		expect(saveExport.mock.lastCall?.[0].runId).toBe(first.runId);
	});

	it("is offered only when the host can save an export", () => {
		expect(setup().session.commands.resolve("export")).toBeUndefined();
		expect(
			setup({ host: { saveExport: vi.fn() } }).session.commands.resolve(
				"export",
			),
		).toBeDefined();
	});

	it("reports a save that failed as the command failing", async () => {
		const { session, latest } = setup({
			host: {
				saveExport: vi.fn(async () => {
					throw new Error("Disk full");
				}),
			},
		});
		await start(session);
		latest().reconcile({ status: "COMPLETED" });
		expect(await session.submit(":export")).toEqual({
			kind: "error",
			message: ":export failed: Disk full",
		});
	});
});

describe("disposing", () => {
	it("stops polling, leaves the run going, and ignores what arrives after", async () => {
		const { session, latest } = setup();
		await start(session);
		const run = latest();
		run.poll({ status: "RUNNING" });
		const before = session.getState();
		const listener = vi.fn();
		session.subscribe(listener);

		session.dispose();
		expect(run.fake.stop).toHaveBeenCalled();
		expect(run.fake.cancel).not.toHaveBeenCalled();

		// The real store can deliver a poll that was in flight when it stopped.
		run.poll({ status: "RUNNING" }, [run.started(message("m1", "late"))]);
		await settle();
		expect(session.getState()).toBe(before);
		expect(listener).not.toHaveBeenCalled();
	});

	it("does not follow a run the backend accepted after the console went away", async () => {
		const accepted = deferred<AgentStore>();
		const { session } = setup({
			roomId: "room-1",
			backend: { startRun: vi.fn(() => accepted.promise) },
		});
		await start(session);
		session.dispose();

		const run = fakeAgent("room-1");
		accepted.resolve(run.agent);
		await settle();
		expect(run.fake.watch).not.toHaveBeenCalled();
		expect(run.fake.cancel).not.toHaveBeenCalled();
	});

	it("does not report a room created after the console went away", async () => {
		const created = deferred<string>();
		const onRoomChange = vi.fn();
		const { session, backend } = setup({
			backend: { createRoom: vi.fn(() => created.promise) },
			host: { onRoomChange },
		});
		await start(session);
		session.dispose();

		created.resolve("room-late");
		await settle();
		expect(onRoomChange).not.toHaveBeenCalled();
		expect(backend.startRun).not.toHaveBeenCalled();
	});
});

describe("selectors", () => {
	it("name what the next run starts with, and the run in progress", async () => {
		const { session } = setup();
		expect(currentHarness(session.getState())?.label).toBe("SEMOSS");
		expect(currentModel(session.getState())?.name).toBe("GPT-5");
		expect(activeRunEntry(session.getState())).toBeUndefined();
		await start(session);
		expect(activeRunEntry(session.getState())?.prompt).toBe(PROMPT);
	});

	it("keyedApproval returns the first non-question waiting action", async () => {
		const bash = action({
			actionId: "a-bash",
			toolCallId: "t1",
			toolName: "Bash",
		});
		const question = action({
			actionId: "a-question",
			toolName: "RequestUserInput",
		});
		const { session, latest } = setup();
		await start(session);
		expect(keyedApproval(session.getState())).toBeUndefined();
		latest().poll({ status: "INPUT_REQUIRED", pendingActions: [question] });
		expect(keyedApproval(session.getState())).toBeUndefined();
		latest().poll({
			status: "INPUT_REQUIRED",
			pendingActions: [question, bash],
		});
		expect(keyedApproval(session.getState())?.actionId).toBe("a-bash");
	});
});

describe("editing a call", () => {
	const bash = action({
		actionId: "a-bash",
		toolCallId: "t1",
		toolName: "Bash",
		toolArgs: { command: "ls -la" },
	});
	const question = action({
		actionId: "a-question",
		toolName: "RequestUserInput",
	});

	const waitingOn = async (...pending: PendingAgentAction[]) => {
		const { session, latest } = setup();
		await start(session);
		const run = latest();
		run.poll({ status: "INPUT_REQUIRED", pendingActions: pending }, [
			run.started(tool("t1", "Run a command")),
		]);
		return { session, run };
	};

	it("startEdit gives the keyed approval's arguments as an :edit command, and says nothing", async () => {
		const { session } = await waitingOn(bash);
		expect(session.startEdit()).toBe(
			`:edit ${JSON.stringify(bash.toolArgs, null, 2)}`,
		);
		expect(notices(session)).toEqual([]);
	});

	it("skips a question queued before the call", async () => {
		const { session } = await waitingOn(question, bash);
		expect(session.startEdit()).toBe(
			`:edit ${JSON.stringify(bash.toolArgs, null, 2)}`,
		);
	});

	it("with only a question waiting: undefined and the answerInForm notice", async () => {
		const { session } = await waitingOn(question);
		expect(session.startEdit()).toBeUndefined();
		expect(notices(session)).toEqual([
			"The agent asked a question. Answer it in the form, or type :deny to dismiss it.",
		]);
	});

	it("with nothing waiting: undefined and the nothingPending notice", async () => {
		const { session } = setup();
		expect(session.startEdit()).toBeUndefined();
		expect(notices(session)).toEqual(["Nothing is waiting for approval."]);
	});

	it("edit with changed JSON calls decide with the parsed object", async () => {
		const { session, run } = await waitingOn(bash);
		session.startEdit();
		await session.edit('{"command": "pwd"}');
		expect(run.fake.decide).toHaveBeenCalledWith(bash, "submit", {
			command: "pwd",
		});
		expect(notices(session)).toEqual([
			"Approved Run a command with your changes.",
		]);
	});

	it("with the JSON unchanged, says approved, not approved with changes", async () => {
		const { session, run } = await waitingOn(bash);
		session.startEdit();
		expect(await session.edit('{"command": "ls -la"}')).toBe(true);
		expect(run.fake.decide).toHaveBeenCalledWith(bash, "submit", {
			command: "ls -la",
		});
		expect(notices(session)).toEqual(["Approved Run a command."]);
	});

	it("JSON spread over several lines works", async () => {
		const { session, run } = await waitingOn(bash);
		await session.edit('{\n  "command": "pwd"\n}');
		expect(run.fake.decide).toHaveBeenCalledWith(bash, "submit", {
			command: "pwd",
		});
	});

	it("invalid JSON: the editInvalid notice, decide not called", async () => {
		const { session, run } = await waitingOn(bash);
		expect(await session.edit("{not json}")).toBe(false);
		expect(run.fake.decide).not.toHaveBeenCalled();
		expect(notices(session).some((n) => n.includes("not valid JSON"))).toBe(
			true,
		);
		expect(lastRun(session).pendingActions).toEqual([bash]);
	});

	it("an array: the editNotObject notice", async () => {
		const { session, run } = await waitingOn(bash);
		expect(await session.edit("[]")).toBe(false);
		expect(run.fake.decide).not.toHaveBeenCalled();
		expect(notices(session)).toEqual([
			"The arguments must be a JSON object, in braces.",
		]);
	});

	it("startEdit, then the call is approved, then edit: nothing is sent, and the call is forgotten", async () => {
		const { session, run } = await waitingOn(bash);
		session.startEdit();
		await session.approve();
		expect(await session.edit('{"command": "pwd"}')).toBe(false);
		expect(run.fake.decide).toHaveBeenCalledTimes(1);
		expect(notices(session).at(-1)).toBe(
			"The call you were editing is no longer waiting. Nothing was sent.",
		);
		expect(await session.edit('{"command": "pwd"}')).toBe(false);
		expect(run.fake.decide).toHaveBeenCalledTimes(1);
		expect(notices(session).at(-1)).toBe(
			"Nothing is waiting for approval.",
		);
	});

	it("forgets the call once its edit is sent, so the next edit is the next call's", async () => {
		const write = action({
			actionId: "a-write",
			toolCallId: "t2",
			toolName: "Write",
			toolArgs: { path: "a.txt" },
		});
		const { session, run } = await waitingOn(bash, write);
		session.startEdit();
		expect(await session.edit('{"command": "pwd"}')).toBe(true);
		expect(await session.edit('{"path": "b.txt"}')).toBe(true);
		expect(run.fake.decide).toHaveBeenLastCalledWith(write, "submit", {
			path: "b.txt",
		});
	});

	it("an argument holding an RLO: startEdit shows its escape, and edit sends the character itself", async () => {
		const rlo = String.fromCodePoint(0x202e);
		const tricky = action({ ...bash, toolArgs: { command: `ls${rlo}` } });
		const { session, run } = await waitingOn(tricky);
		const text = session.startEdit() ?? "";
		expect(text).toContain(`${String.fromCodePoint(92)}u202e`);
		expect(text).not.toContain(rlo);
		expect(await session.edit(text.slice(":edit ".length))).toBe(true);
		expect(run.fake.decide).toHaveBeenCalledWith(tricky, "submit", {
			command: `ls${rlo}`,
		});
		expect(notices(session)).toEqual(["Approved Run a command."]);
	});
});

describe("always allowing a tool", () => {
	const bash = action({
		actionId: "a-bash",
		toolCallId: "t1",
		toolName: "Bash",
	});
	const bash2 = action({
		actionId: "a-bash-2",
		toolCallId: "t2",
		toolName: "Bash",
	});
	const edit = action({
		actionId: "a-edit",
		toolCallId: "t3",
		toolName: "Edit",
	});
	const question = action({
		actionId: "a-question",
		toolName: "RequestUserInput",
	});

	const waitingOn = async (...pending: PendingAgentAction[]) => {
		const { session, latest } = setup();
		await start(session);
		const run = latest();
		run.poll({ status: "INPUT_REQUIRED", pendingActions: pending }, [
			run.started(tool("t1", "Run a command")),
		]);
		return { session, run };
	};

	it("alwaysAllow approves, lists the tool, and says alwaysAllowed", async () => {
		const { session } = await waitingOn(bash);
		expect(await session.alwaysAllow()).toBe(true);
		expect(session.getState().alwaysAllowed).toEqual([
			{ toolName: "Bash", label: "Run a command" },
		]);
		expect(notices(session)).toEqual([
			"Approved Run a command. It runs without asking until you type :revoke, start a new room or reload.",
		]);
	});

	it("lists nothing when the approval itself is refused", async () => {
		const { session, run } = await waitingOn(bash);
		run.fake.decide.mockRejectedValueOnce(new Error("Action stale"));
		expect(await session.alwaysAllow()).toBe(false);
		expect(session.getState().alwaysAllowed).toEqual([]);
		expect(notices(session)).toEqual([
			"Could not send the decision: Action stale",
		]);
	});

	it("never allows a question: it goes to its form, and nothing is listed", async () => {
		const { session, run } = await waitingOn(question);
		expect(await session.alwaysAllow()).toBe(false);
		expect(run.fake.decide).not.toHaveBeenCalled();
		expect(session.getState().alwaysAllowed).toEqual([]);
		expect(notices(session)).toEqual([
			"The agent asked a question. Answer it in the form, or type :deny to dismiss it.",
		]);
	});

	it("allows the call waiting behind a question, and leaves the question waiting", async () => {
		const { session, run } = await waitingOn(question, bash);
		expect(await session.alwaysAllow()).toBe(true);
		expect(run.fake.decide).toHaveBeenCalledTimes(1);
		expect(run.fake.decide).toHaveBeenCalledWith(bash, "submit", undefined);
		expect(session.getState().alwaysAllowed).toEqual([
			{ toolName: "Bash", label: "Run a command" },
		]);
		expect(lastRun(session).pendingActions).toEqual([question]);
	});

	it("a later poll bringing a new call of the same tool: decided automatically, silently, never shown waiting", async () => {
		const { session, latest } = setup();
		await start(session);
		latest().poll({ status: "INPUT_REQUIRED", pendingActions: [bash] }, [
			latest().started(tool("t1", "Run a command")),
		]);
		await session.alwaysAllow();
		const noticesBefore = notices(session);
		const states: SessionState[] = [];
		const unsubscribe = session.subscribe(() => {
			states.push(session.getState());
		});
		latest().poll({ status: "INPUT_REQUIRED", pendingActions: [bash2] }, [
			latest().started(tool("t2", "Another command")),
		]);
		await settle();
		unsubscribe();
		expect(states).not.toHaveLength(0);
		expect(
			states.some((each) =>
				each.entries.some(
					(entry) =>
						entry.kind === "run" &&
						entry.pendingActions.some(
							(waiting) => waiting.actionId === bash2.actionId,
						),
				),
			),
		).toBe(false);
		expect(notices(session)).toEqual(noticesBefore);
		expect(lastRun(session).pendingActions).toEqual([]);
		expect(latest().fake.decide).toHaveBeenCalledWith(
			bash2,
			"submit",
			undefined,
		);
	});

	it("the same through a reconcile that is not final", async () => {
		const { session, latest } = setup();
		await start(session);
		latest().poll({ status: "INPUT_REQUIRED", pendingActions: [bash] });
		await session.alwaysAllow();
		latest().reconcile({
			status: "INPUT_REQUIRED",
			pendingActions: [bash2],
		});
		expect(lastRun(session).pendingActions).toEqual([]);
		expect(latest().fake.decide).toHaveBeenCalledWith(
			bash2,
			"submit",
			undefined,
		);
	});

	it("a final reconcile sends nothing", async () => {
		const { session, latest } = setup();
		await start(session);
		latest().poll({ status: "INPUT_REQUIRED", pendingActions: [bash] });
		await session.alwaysAllow();
		latest().reconcile({ status: "COMPLETED", pendingActions: [bash2] });
		expect(latest().fake.decide).toHaveBeenCalledTimes(1);
	});

	it("a call of another tool still waits", async () => {
		const { session, latest } = setup();
		await start(session);
		latest().poll({ status: "INPUT_REQUIRED", pendingActions: [bash] });
		await session.alwaysAllow();
		latest().poll({ status: "INPUT_REQUIRED", pendingActions: [edit] });
		expect(lastRun(session).pendingActions).toEqual([edit]);
	});

	it("two calls of the same tool waiting together: always allowing the first decides both", async () => {
		const { session, run } = await waitingOn(bash, bash2);
		await session.alwaysAllow();
		expect(run.fake.decide).toHaveBeenCalledTimes(2);
		expect(lastRun(session).pendingActions).toEqual([]);
	});

	it("hasUi: true: the cannotAlwaysAllow notice, nothing decided, nothing listed", async () => {
		const uiCall = action({ ...bash, hasUi: true });
		const { session, run } = await waitingOn(uiCall);
		expect(await session.alwaysAllow()).toBe(false);
		expect(run.fake.decide).not.toHaveBeenCalled();
		expect(session.getState().alwaysAllowed).toEqual([]);
		expect(notices(session)).toContain(
			"Run a command cannot be always allowed, so it is asked about every time.",
		);
	});

	it("toolName: null: the cannotAlwaysAllow notice", async () => {
		const noName = action({ ...bash, toolName: null });
		const { session, run } = await waitingOn(noName);
		expect(await session.alwaysAllow(noName)).toBe(false);
		expect(run.fake.decide).not.toHaveBeenCalled();
		expect(session.getState().alwaysAllowed).toEqual([]);
	});

	it("an automatic approval the backend refuses: shown waiting again, said, and not retried", async () => {
		const { session, latest } = setup();
		await start(session);
		latest().poll({ status: "INPUT_REQUIRED", pendingActions: [bash] }, [
			latest().started(tool("t1", "Run a command")),
		]);
		await session.alwaysAllow();
		latest().fake.decide.mockRejectedValueOnce(new Error("Action stale"));
		latest().poll({ status: "INPUT_REQUIRED", pendingActions: [bash2] }, [
			latest().started(tool("t2", "Another command")),
		]);
		await settle();
		expect(lastRun(session).pendingActions).toEqual([bash2]);
		expect(notices(session).at(-1)).toBe(
			"Could not approve Another command automatically: Action stale. It is waiting for you.",
		);
		latest().poll({ status: "INPUT_REQUIRED", pendingActions: [bash2] });
		await settle();
		expect(lastRun(session).pendingActions).toEqual([bash2]);
		expect(
			latest().fake.decide.mock.calls.filter(
				([decided]) => decided.actionId === bash2.actionId,
			),
		).toHaveLength(1);
	});

	it("revoke by label", async () => {
		const { session } = await waitingOn(bash);
		await session.alwaysAllow();
		expect(session.revoke("Run a command")).toBe(true);
		expect(session.getState().alwaysAllowed).toEqual([]);
		expect(notices(session)).toContain(
			"Run a command will be asked about again.",
		);
	});

	it("revoke by toolName, ignoring case and surrounding spaces", async () => {
		const { session } = await waitingOn(bash);
		await session.alwaysAllow();
		expect(session.revoke("  bash  ")).toBe(true);
		expect(session.getState().alwaysAllowed).toEqual([]);
		expect(notices(session).at(-1)).toBe(
			"Run a command will be asked about again.",
		);
	});

	it("revoke() clearing all: revokedAll", async () => {
		const { session } = await waitingOn(bash);
		await session.alwaysAllow();
		expect(session.revoke()).toBe(true);
		expect(session.getState().alwaysAllowed).toEqual([]);
		expect(notices(session)).toContain(
			"Every tool will be asked about again.",
		);
	});

	it("revoke with only spaces revokes every tool", async () => {
		const { session } = await waitingOn(bash);
		await session.alwaysAllow();
		expect(session.revoke("   ")).toBe(true);
		expect(session.getState().alwaysAllowed).toEqual([]);
		expect(notices(session).at(-1)).toBe(
			"Every tool will be asked about again.",
		);
	});

	it("revoke() with none: allowedNone", async () => {
		const { session } = setup();
		expect(session.revoke()).toBe(false);
		expect(notices(session)).toEqual(["No tool runs without asking."]);
	});

	it('revoke("nope"): unknownAllowed and false', async () => {
		const { session } = await waitingOn(bash);
		await session.alwaysAllow();
		expect(session.revoke("nope")).toBe(false);
		expect(notices(session)).toContain(
			'No tool named "nope" runs without asking. Type :allowed to list them.',
		);
		expect(session.getState().alwaysAllowed).toEqual([
			{ toolName: "Bash", label: "Run a command" },
		]);
	});

	it(":allowed lists each tool by its label, with its name when that differs", async () => {
		const { session } = await waitingOn(bash, edit);
		await session.alwaysAllow();
		await session.alwaysAllow();
		expect(await session.submit(":allowed")).toEqual({
			kind: "ran",
			name: "allowed",
		});
		expect(notices(session).slice(-4)).toEqual([
			"Tools that run without asking",
			"  Run a command  Bash",
			"  Edit",
			"Type :revoke followed by a name to be asked about it again, or :revoke alone for every tool.",
		]);
		expect(session.getState().entries.at(-1)).toMatchObject({
			kind: "notice",
			lines: [
				{ segments: [{ emphasis: "bold" }] },
				{
					segments: [
						{ text: "  " },
						{ text: "Run a command", emphasis: "code" },
						{ text: "  " },
						{ text: "Bash", emphasis: "dim" },
					],
				},
				{
					segments: [
						{ text: "  " },
						{ text: "Edit", emphasis: "code" },
					],
				},
				{ segments: [{ emphasis: "dim" }] },
			],
		});
	});

	it("newRoom clears the list and says revokedAll after the newRoom notice", async () => {
		const { session, run } = await waitingOn(bash);
		await session.alwaysAllow();
		run.reconcile({ status: "COMPLETED" });
		await settle();
		expect(session.newRoom()).toBe(true);
		expect(session.getState().alwaysAllowed).toEqual([]);
		expect(notices(session)).toEqual([
			"New room. It is saved when you send the first prompt.",
			"Every tool will be asked about again.",
		]);
	});

	it("newRoom with an empty list does not say revokedAll", async () => {
		const { session, latest } = setup();
		await start(session);
		latest().reconcile({ status: "COMPLETED" });
		await settle();
		expect(session.newRoom()).toBe(true);
		expect(notices(session)).toEqual([
			"New room. It is saved when you send the first prompt.",
		]);
	});
});

describe("following subagents", () => {
	type SubagentItem = Extract<AgentRunItem, { kind: "subagent" }>;
	type SetupOptions = NonNullable<Parameters<typeof setup>[0]>;

	let childCount = 0;
	/** Unique across the file, as run ids are: the run registry is module-level. */
	const childId = () => `child-${++childCount}`;

	const subagentItem = (
		childRunId: string,
		extra: Partial<SubagentItem> = {},
	): SubagentItem => ({
		id: childRunId,
		kind: "subagent",
		childRunId,
		roomId: `room-${childRunId}`,
		status: "RUNNING",
		...extra,
	});

	/** A poll of `run` that brings a subagent it spawned. */
	const spawn = (run: FakeRun, childRunId: string, alias?: string) =>
		run.poll({ status: "RUNNING" }, [
			run.started(subagentItem(childRunId, { alias })),
		]);

	/** A session whose backend can follow a run: a fake store for each it follows. */
	const following = ({ backend, ...options }: SetupOptions = {}) => {
		const followed = new Map<string, FakeRun>();
		const followRun = vi.fn(
			({ runId, roomId }: { runId: string; roomId: string }) => {
				const run = fakeAgent(roomId, runId);
				followed.set(runId, run);
				return run.agent;
			},
		);
		const context = setup({
			...options,
			backend: { followRun, ...backend },
		});
		const child = (runId: string) => {
			const run = followed.get(runId);
			if (run === undefined) {
				throw new Error(`${runId} is not followed`);
			}
			return run;
		};
		return { ...context, followRun, child };
	};

	/** A session whose run has spawned "reviewer", and follows it. */
	const followingReviewer = async (options?: SetupOptions) => {
		const context = following(options);
		await start(context.session);
		const root = context.latest();
		const id = childId();
		spawn(root, id, "reviewer");
		return { ...context, root, id, reviewer: context.child(id) };
	};

	/** Lines as the words on screen, each subagent's own under it, indented. */
	const tree = (lines: readonly Line[], indent = ""): string[] =>
		lines.flatMap((line) => [
			`${indent}${plain(line)}`,
			...(line.kind === "subagent"
				? tree(line.children ?? [], `${indent}  `)
				: []),
		]);

	const treeScreen = (session: Session) =>
		tree(
			session
				.getState()
				.entries.flatMap((entry) =>
					entryLines(entry, session.translate),
				),
		);

	/** What the last run knows of the subagent at `path` under it. */
	const recordAt = (session: Session, ...path: string[]) => {
		let run: RunProgress | undefined = lastRun(session);
		let record: SubagentRun | undefined;
		for (const id of path) {
			record = run?.subagents?.[id];
			run = record?.followed ? record : undefined;
		}
		return record;
	};

	const bash = action({ actionId: "child-bash", toolCallId: "t1" });

	describe("which it follows", () => {
		it("follows a subagent in its own room, and draws its run under its line", async () => {
			const { session, latest, followRun, child } = following();
			await start(session);
			const id = childId();
			spawn(latest(), id, "reviewer");

			expect(followRun).toHaveBeenCalledTimes(1);
			expect(followRun).toHaveBeenCalledWith({
				runId: id,
				roomId: `room-${id}`,
			});
			const reviewer = child(id);
			expect(reviewer.fake.watch).toHaveBeenCalledTimes(1);
			expect(recordAt(session, id)).toMatchObject({
				followed: true,
				runId: id,
				status: "STARTING",
			});

			reviewer.poll({ status: "RUNNING" }, [
				reviewer.started(message("m1", "Reading the tests.")),
			]);
			expect(recordAt(session, id)).toMatchObject({ status: "RUNNING" });
			expect(treeScreen(session)).toEqual([
				PROMPT,
				"reviewer",
				"  Reading the tests.",
			]);
		});

		it("follows each subagent once, whatever its parent says of it after", async () => {
			const { session, root, id, followRun, reviewer } =
				await followingReviewer();
			root.poll({ status: "RUNNING" }, [
				root.patched(id, {
					status: "COMPLETED",
					resultPreview: "Fine.",
				}),
			]);
			root.poll({ status: "RUNNING" });
			expect(followRun).toHaveBeenCalledTimes(1);
			expect(reviewer.fake.watch).toHaveBeenCalledTimes(1);
			expect(recordAt(session, id)).toMatchObject({
				followed: true,
				status: "STARTING",
			});
		});

		it("follows one that has already ended, for the steps the server still keeps", async () => {
			const { session, latest, followRun } = following();
			await start(session);
			const root = latest();
			const id = childId();
			root.poll({ status: "RUNNING" }, [
				root.started(subagentItem(id, { status: "COMPLETED" })),
			]);
			expect(followRun).toHaveBeenCalledTimes(1);
			expect(recordAt(session, id)).toMatchObject({ followed: true });
		});

		it("draws a subagent only as its parent reports it, when the host cannot follow a run", async () => {
			const { session, latest } = setup();
			await start(session);
			spawn(latest(), childId(), "reviewer");
			expect(lastRun(session).subagents).toBeUndefined();
			const line = entryLines(lastRun(session)).at(-1);
			expect(line).toMatchObject({ kind: "subagent", label: "reviewer" });
			expect(line !== undefined && "children" in line).toBe(false);
		});

		it("does not follow one deeper than the host allows, and says so under it", async () => {
			const { session, followRun, child, id } = await followingReviewer({
				subagents: { maxDepth: 1 },
			});
			const deeper = childId();
			spawn(child(id), deeper, "checker");
			expect(followRun).toHaveBeenCalledTimes(1);
			expect(recordAt(session, id, deeper)).toEqual({
				followed: false,
				reason: "depth",
				limit: 1,
			});
			expect(treeScreen(session)).toEqual([
				PROMPT,
				"reviewer",
				"  checker",
				"    Its steps are not shown: subagents are followed to a depth of 1.",
			]);
		});

		it("follows MAX_SUBAGENT_DEPTH levels by default", async () => {
			const { session, latest, followRun, child } = following();
			await start(session);
			const path: string[] = [];
			let parent = latest();
			for (let level = 0; level <= MAX_SUBAGENT_DEPTH; level++) {
				const id = childId();
				spawn(parent, id);
				path.push(id);
				if (level < MAX_SUBAGENT_DEPTH) {
					parent = child(id);
				}
			}
			expect(followRun).toHaveBeenCalledTimes(MAX_SUBAGENT_DEPTH);
			expect(recordAt(session, ...path)).toEqual({
				followed: false,
				reason: "depth",
				limit: MAX_SUBAGENT_DEPTH,
			});
		});

		it("follows no more runs at once than the host allows, and another once one ends", async () => {
			const { session, latest, followRun, child } = following({
				subagents: { maxFollowed: 2 },
			});
			await start(session);
			const root = latest();
			const [a, b, c, d] = [childId(), childId(), childId(), childId()];
			root.poll(
				{ status: "RUNNING" },
				[a, b, c].map((id) => root.started(subagentItem(id))),
			);
			expect(followRun).toHaveBeenCalledTimes(2);
			expect(recordAt(session, c)).toEqual({
				followed: false,
				reason: "limit",
				limit: 2,
			});
			expect(treeScreen(session).at(-1)).toBe(
				"  Its steps are not shown: subagents are followed at most 2 at a time.",
			);

			child(a).reconcile({ status: "COMPLETED" });
			spawn(root, d);
			expect(followRun).toHaveBeenCalledTimes(3);
			expect(recordAt(session, d)).toMatchObject({ followed: true });
			// Each subagent is decided once: the one left out stays out.
			expect(recordAt(session, c)).toMatchObject({ followed: false });
		});

		it("follows MAX_FOLLOWED_SUBAGENTS runs at once by default, counting every run's", async () => {
			const { session, latest, followRun } = following();
			await start(session);
			const first = latest();
			first.poll(
				{ status: "RUNNING" },
				Array.from({ length: MAX_FOLLOWED_SUBAGENTS - 1 }, () =>
					first.started(subagentItem(childId())),
				),
			);
			first.reconcile({ status: "COMPLETED" });

			await start(session, "Next");
			const second = latest();
			const [last, over] = [childId(), childId()];
			second.poll({ status: "RUNNING" }, [
				second.started(subagentItem(last)),
				second.started(subagentItem(over)),
			]);
			expect(followRun).toHaveBeenCalledTimes(MAX_FOLLOWED_SUBAGENTS);
			expect(recordAt(session, last)).toMatchObject({ followed: true });
			expect(recordAt(session, over)).toEqual({
				followed: false,
				reason: "limit",
				limit: MAX_FOLLOWED_SUBAGENTS,
			});
		});

		it("says why it could not follow one, and does not try again", async () => {
			const followRun = vi.fn((): AgentStore => {
				throw new Error("No insight");
			});
			const { session, latest } = setup({ backend: { followRun } });
			await start(session);
			const root = latest();
			const id = childId();
			spawn(root, id, "reviewer");
			root.poll({ status: "RUNNING" });
			expect(followRun).toHaveBeenCalledTimes(1);
			expect(recordAt(session, id)).toEqual({
				followed: false,
				reason: "failed",
				message: "No insight",
			});
			expect(treeScreen(session)).toEqual([
				PROMPT,
				"reviewer",
				"  Its steps cannot be shown: No insight",
			]);
		});
	});

	describe("for as long as it runs", () => {
		it("keeps following it after its parent ends, in the parent's entry, and frees the prompt", async () => {
			const { session, root, reviewer } = await followingReviewer();
			root.reconcile({
				status: "COMPLETED",
				finalText: "Handed it over.",
			});
			expect(session.getState().activeEntryId).toBeUndefined();

			reviewer.poll({ status: "RUNNING" }, [
				reviewer.started(message("m1", "Still reading.")),
			]);
			expect(await start(session, "Next")).toMatchObject({
				kind: "started",
			});
			reviewer.poll({ status: "RUNNING" }, [
				reviewer.started(message("m2", "Found it.")),
			]);

			const [first] = session
				.getState()
				.entries.filter(
					(entry): entry is RunEntry => entry.kind === "run",
				);
			expect(tree(entryLines(first))).toEqual([
				PROMPT,
				"reviewer",
				"  Still reading.",
				"  Found it.",
				"Handed it over.",
			]);
		});

		it("stops following it when its own run ends, and ignores what arrives after", async () => {
			const { session, reviewer, id } = await followingReviewer();
			reviewer.reconcile({
				status: "COMPLETED",
				finalText: "Looks fine.",
			});
			expect(recordAt(session, id)).toMatchObject({
				status: "COMPLETED",
				endedAt: 1000,
			});
			expect(reviewer.fake.stop).toHaveBeenCalled();
			expect(treeScreen(session)).toEqual([
				PROMPT,
				"reviewer",
				"  Looks fine.",
			]);

			const before = session.getState();
			reviewer.poll({ status: "RUNNING" }, [
				reviewer.started(message("m1", "late")),
			]);
			await settle();
			expect(session.getState()).toBe(before);
		});

		it("says when it loses a subagent's run", async () => {
			const { session, reviewer, id } = await followingReviewer();
			reviewer.poll({ status: "RUNNING" });
			reviewer.endPolling();
			await settle();
			expect(recordAt(session, id)).toMatchObject({
				status: "LOST",
				endedAt: 1000,
			});
			expect(treeScreen(session)).toEqual([
				PROMPT,
				"reviewer",
				"  Lost contact with this run. It may still be running on the server.",
			]);
		});

		it("says under a subagent when its polls fail, until one gets through", async () => {
			const { session, reviewer } = await followingReviewer();
			reviewer.fail(new Error("offline"));
			expect(treeScreen(session)).toEqual([
				PROMPT,
				"reviewer",
				"  Cannot reach the server. Retrying… (offline)",
			]);
			reviewer.poll({ status: "RUNNING" });
			expect(treeScreen(session)).toEqual([PROMPT, "reviewer"]);
		});
	});

	describe("a call it waits on", () => {
		const question = action({
			actionId: "child-question",
			toolName: "RequestUserInput",
		});

		/** "reviewer" waiting on `pending`, the tool `t1` drawn. */
		const reviewerWaiting = async (...pending: PendingAgentAction[]) => {
			const context = await followingReviewer();
			const { reviewer } = context;
			reviewer.poll(
				{ status: "INPUT_REQUIRED", pendingActions: pending },
				[reviewer.started(tool("t1", "Run a command"))],
			);
			return context;
		};

		it("is offered with the rest, named by the subagent it is under", async () => {
			const { session } = await reviewerWaiting(bash);
			expect(keyedApproval(session.getState())).toEqual(bash);
			expect(waitingActions(session.getState())).toMatchObject([
				{
					action: bash,
					subagents: ["reviewer"],
					tool: "Run a command",
					label: "reviewer › Run a command",
					parentEnded: false,
				},
			]);
		});

		it("is approved through the subagent's own store", async () => {
			const { session, root, reviewer, id } = await reviewerWaiting(bash);
			expect(await session.approve()).toBe(true);
			expect(reviewer.fake.decide).toHaveBeenCalledWith(
				bash,
				"submit",
				undefined,
			);
			expect(root.fake.decide).not.toHaveBeenCalled();
			expect(recordAt(session, id)).toMatchObject({ pendingActions: [] });
			expect(notices(session)).toEqual([
				"Approved reviewer › Run a command.",
			]);
		});

		it("is denied there too", async () => {
			const { session, reviewer } = await reviewerWaiting(bash);
			expect(await session.deny()).toBe(true);
			expect(reviewer.fake.decide).toHaveBeenCalledWith(
				bash,
				"reject",
				undefined,
			);
			expect(notices(session)).toEqual([
				"Denied reviewer › Run a command.",
			]);
		});

		it("is answered there, when it is a question", async () => {
			const { session, reviewer } = await reviewerWaiting(question);
			expect(await session.respond(question, { q1: "yes" })).toBe(true);
			expect(reviewer.fake.decide).toHaveBeenCalledWith(
				question,
				"respond",
				{
					q1: "yes",
				},
			);
		});

		it("goes to the store of the run that lists it, of several", async () => {
			const { session, root, reviewer, child } =
				await followingReviewer();
			const otherId = childId();
			spawn(root, otherId, "checker");
			const checker = child(otherId);
			const other = action({
				actionId: "checker-bash",
				toolCallId: "t1",
			});
			reviewer.poll(
				{ status: "INPUT_REQUIRED", pendingActions: [bash] },
				[reviewer.started(tool("t1", "Run a command"))],
			);
			checker.poll(
				{ status: "INPUT_REQUIRED", pendingActions: [other] },
				[checker.started(tool("t1", "Run a command"))],
			);

			expect(await session.approve(other)).toBe(true);
			expect(checker.fake.decide).toHaveBeenCalledWith(
				other,
				"submit",
				undefined,
			);
			expect(reviewer.fake.decide).not.toHaveBeenCalled();
			expect(notices(session)).toEqual([
				"Approved checker › Run a command.",
			]);
		});

		it("is offered again in the subagent when the decision does not reach the backend", async () => {
			const { session, reviewer, id } = await reviewerWaiting(bash);
			reviewer.fake.decide.mockRejectedValueOnce(
				new Error("Action already decided"),
			);
			expect(await session.approve()).toBe(false);
			expect(recordAt(session, id)).toMatchObject({
				pendingActions: [bash],
			});
			expect(notices(session)).toEqual([
				"Could not send the decision: Action already decided",
			]);
		});

		it("is offered after its parent has ended, which will not use the subagent's result", async () => {
			const { session, root, reviewer } = await followingReviewer();
			root.reconcile({ status: "COMPLETED" });
			reviewer.poll(
				{ status: "INPUT_REQUIRED", pendingActions: [bash] },
				[reviewer.started(tool("t1", "Run a command"))],
			);
			expect(treeScreen(session)).toEqual([
				PROMPT,
				"reviewer",
				"  Run a command",
				"  Run a command is waiting for approval.",
				"  Type :approve to allow it, or :deny to reject it.",
				"  The parent run has ended and will not use this subagent's result. Deciding lets the subagent carry on, and what it does is shown here.",
			]);
			expect(waitingActions(session.getState())).toMatchObject([
				{ action: bash, parentEnded: true },
			]);
			expect(await session.approve()).toBe(true);
			expect(reviewer.fake.decide).toHaveBeenCalledWith(
				bash,
				"submit",
				undefined,
			);
		});

		it("comes after the calls of the run in progress", async () => {
			const { session, latest, root, reviewer } =
				await followingReviewer();
			root.reconcile({ status: "COMPLETED" });
			reviewer.poll(
				{ status: "INPUT_REQUIRED", pendingActions: [bash] },
				[reviewer.started(tool("t1", "Run a command"))],
			);
			await start(session, "Next");
			const next = latest();
			const write = action({
				actionId: "next-write",
				toolCallId: "t1",
				toolName: "Write",
			});
			next.poll({ status: "INPUT_REQUIRED", pendingActions: [write] }, [
				next.started(tool("t1", "Write a file")),
			]);

			expect(
				waitingActions(session.getState()).map(
					(waiting) => waiting.label,
				),
			).toEqual(["Write a file", "reviewer › Run a command"]);
			expect(keyedApproval(session.getState())).toEqual(write);
		});
	});

	describe("stopping", () => {
		it("stops the run in progress, which stops its subagents on the server", async () => {
			const { session, root, reviewer, id } = await followingReviewer();
			await session.interrupt();
			expect(root.fake.cancel).toHaveBeenCalledTimes(1);
			expect(reviewer.fake.cancel).not.toHaveBeenCalled();
			expect(lastRun(session).stopRequested).toBe(true);
			expect(recordAt(session, id)).not.toHaveProperty("stopRequested");
		});

		it("stops the subagents a finished run left running", async () => {
			const { session, root, reviewer } = await followingReviewer();
			root.reconcile({ status: "COMPLETED" });
			const stopping = session.interrupt();
			expect(treeScreen(session)).toEqual([
				PROMPT,
				"reviewer",
				"  Stopping…",
			]);
			await stopping;
			expect(root.fake.cancel).not.toHaveBeenCalled();
			expect(reviewer.fake.cancel).toHaveBeenCalledTimes(1);
			expect(reviewer.fake.pokeNow).toHaveBeenCalledTimes(1);

			reviewer.reconcile({ status: "CANCELLED" });
			expect(treeScreen(session)).toEqual([
				PROMPT,
				"reviewer",
				"  Run cancelled.",
			]);
		});

		it("stops them while the finished run drains its last events", async () => {
			const { session, root, reviewer } = await followingReviewer();
			root.poll({ status: "COMPLETED" });
			await session.interrupt();
			expect(root.fake.cancel).not.toHaveBeenCalled();
			expect(reviewer.fake.cancel).toHaveBeenCalledTimes(1);
		});

		it("says a subagent's stop failed, naming it by its path, and takes its stopping line back", async () => {
			const { session, root, child, id } = await followingReviewer();
			const deeper = childId();
			spawn(child(id), deeper, "checker");
			root.reconcile({ status: "COMPLETED" });
			child(deeper).fake.cancel.mockRejectedValueOnce(
				new Error("Forbidden"),
			);

			await session.interrupt();
			expect(child(id).fake.cancel).toHaveBeenCalledTimes(1);
			expect(notices(session)).toEqual([
				"Could not stop reviewer › checker: Forbidden",
			]);
			expect(recordAt(session, id)).toMatchObject({
				stopRequested: true,
			});
			expect(recordAt(session, id, deeper)).toMatchObject({
				stopRequested: false,
			});
		});

		it("says nothing is running once every subagent has ended", async () => {
			const { session, root, reviewer } = await followingReviewer();
			root.reconcile({ status: "COMPLETED" });
			reviewer.reconcile({ status: "COMPLETED" });
			await session.interrupt();
			expect(reviewer.fake.cancel).not.toHaveBeenCalled();
			expect(notices(session)).toEqual(["Nothing is running."]);
		});
	});

	describe("leaving, clearing, closing and exporting", () => {
		it("stops following the subagents a new room leaves behind, and does not stop them", async () => {
			const { session, root, reviewer } = await followingReviewer();
			root.reconcile({ status: "COMPLETED" });
			expect(session.newRoom()).toBe(true);
			expect(reviewer.fake.stop).toHaveBeenCalled();
			expect(reviewer.fake.cancel).not.toHaveBeenCalled();
			expect(notices(session)).toEqual([
				"New room. It is saved when you send the first prompt.",
				"Stopped following the unfinished subagents (1). They were not stopped on the server.",
			]);

			const before = session.getState();
			reviewer.poll({ status: "RUNNING" }, [
				reviewer.started(message("m1", "late")),
			]);
			await settle();
			expect(session.getState()).toBe(before);
		});

		it("says nothing of subagents when none was left", async () => {
			const { session, root, reviewer } = await followingReviewer();
			reviewer.reconcile({ status: "COMPLETED" });
			root.reconcile({ status: "COMPLETED" });
			expect(session.newRoom()).toBe(true);
			expect(notices(session)).toEqual([
				"New room. It is saved when you send the first prompt.",
			]);
		});

		it("keeps a run's entry on clearing while it follows one of its subagents", async () => {
			const { session, root, reviewer } = await followingReviewer();
			root.reconcile({ status: "COMPLETED" });
			session.notice([textLine("A notice")]);
			session.clear();
			expect(
				session.getState().entries.map((entry) => entry.kind),
			).toEqual(["run"]);

			reviewer.reconcile({ status: "COMPLETED" });
			session.clear();
			expect(session.getState().entries).toEqual([]);
		});

		it("stops following every run on closing, and stops none of them", async () => {
			const { session, root, reviewer } = await followingReviewer();
			session.dispose();
			expect(root.fake.stop).toHaveBeenCalled();
			expect(reviewer.fake.stop).toHaveBeenCalled();
			expect(root.fake.cancel).not.toHaveBeenCalled();
			expect(reviewer.fake.cancel).not.toHaveBeenCalled();
		});

		it("exports the prompt's own run, and none of its subagents' events", async () => {
			const saveExport = vi.fn((_data: RunExport) => undefined);
			const { session, latest, child } = following({
				host: { saveExport },
			});
			await start(session);
			const root = latest();
			const id = childId();
			const spawned = root.started(
				subagentItem(id, { alias: "reviewer" }),
			);
			root.poll({ status: "RUNNING" }, [spawned]);
			const reviewer = child(id);
			reviewer.poll(
				{ status: "RUNNING" },
				[reviewer.started(message("m1", "Reading."))],
				3,
			);
			root.reconcile({ status: "COMPLETED" });

			await session.exportLastRun();
			expect(saveExport.mock.lastCall?.[0]).toMatchObject({
				runId: root.runId,
				events: [spawned],
				droppedEvents: 0,
			});
		});
	});

	describe("always allowing a tool", () => {
		const rootBash = action({ actionId: "root-bash", toolCallId: "r1" });
		const bash2 = action({ actionId: "child-bash-2", toolCallId: "t2" });

		it("allows it in every run the session follows", async () => {
			const { session, root, reviewer } = await followingReviewer();
			root.poll(
				{ status: "INPUT_REQUIRED", pendingActions: [rootBash] },
				[root.started(tool("r1", "Run a command"))],
			);
			reviewer.poll(
				{ status: "INPUT_REQUIRED", pendingActions: [bash] },
				[reviewer.started(tool("t1", "Run a command"))],
			);

			expect(await session.alwaysAllow(rootBash)).toBe(true);
			expect(root.fake.decide).toHaveBeenCalledWith(
				rootBash,
				"submit",
				undefined,
			);
			expect(reviewer.fake.decide).toHaveBeenCalledWith(
				bash,
				"submit",
				undefined,
			);
			expect(waitingActions(session.getState())).toEqual([]);
			expect(session.getState().alwaysAllowed).toEqual([
				{ toolName: "Bash", label: "Run a command" },
			]);
			expect(notices(session)).toEqual([
				"Approved Run a command. It runs without asking until you type :revoke, start a new room or reload.",
			]);
		});

		it("approves a subagent's later call of it without asking", async () => {
			const { session, reviewer, id } = await followingReviewer();
			reviewer.poll(
				{ status: "INPUT_REQUIRED", pendingActions: [bash] },
				[reviewer.started(tool("t1", "Run a command"))],
			);
			await session.alwaysAllow();
			reviewer.poll(
				{ status: "INPUT_REQUIRED", pendingActions: [bash2] },
				[reviewer.started(tool("t2", "Another command"))],
			);
			await settle();
			expect(reviewer.fake.decide).toHaveBeenLastCalledWith(
				bash2,
				"submit",
				undefined,
			);
			expect(recordAt(session, id)).toMatchObject({ pendingActions: [] });
			expect(notices(session)).toHaveLength(1);
		});

		it("names the call by its path when an automatic approval is refused", async () => {
			const { session, reviewer, id } = await followingReviewer();
			reviewer.poll(
				{ status: "INPUT_REQUIRED", pendingActions: [bash] },
				[reviewer.started(tool("t1", "Run a command"))],
			);
			await session.alwaysAllow();
			reviewer.fake.decide.mockRejectedValueOnce(
				new Error("Action stale"),
			);
			reviewer.poll(
				{ status: "INPUT_REQUIRED", pendingActions: [bash2] },
				[reviewer.started(tool("t2", "Another command"))],
			);
			await settle();
			expect(recordAt(session, id)).toMatchObject({
				pendingActions: [bash2],
			});
			expect(notices(session).at(-1)).toBe(
				"Could not approve reviewer › Another command automatically: Action stale. It is waiting for you.",
			);
		});
	});
});
