import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAgentRun, pollAgentRun, streamAgentRun } from "../../api/agent";
import type {
	AgentRunItem,
	AgentRunItemEvent,
	AgentRunSnapshot,
} from "../../types";
import {
	AgentStore,
	applyAgentRunItemEvent,
	createAgentRunItemsState,
} from "./agent.store";

vi.mock("../../api/agent", () => ({
	pollAgentRun: vi.fn(),
	getAgentRun: vi.fn(),
	decideAgentRunAction: vi.fn(),
	runAgent: vi.fn(),
	stopAgentRun: vi.fn(),
	streamAgentRun: vi.fn(),
}));

const mockPollAgentRun = vi.mocked(pollAgentRun);
const mockGetAgentRun = vi.mocked(getAgentRun);
const mockStreamAgentRun = vi.mocked(streamAgentRun);

const snapshot = (
	status: AgentRunSnapshot["status"],
	runId = "run-1",
): AgentRunSnapshot => ({
	runId,
	roomId: "room-1",
	status,
	pendingActions: [],
});

const messageItem = (id: string, text: string): AgentRunItem => ({
	id,
	kind: "message",
	role: "assistant",
	text,
});

const startedEvent = (
	sequence: number,
	item: AgentRunItem,
	runId = "run-1",
): AgentRunItemEvent => ({
	version: 1,
	eventId: `evt-${sequence}`,
	sequence,
	runId,
	timestamp: "2026-01-01T00:00:00Z",
	type: "item.started",
	item,
});

const deltaEvent = (
	sequence: number,
	itemId: string,
	delta: string,
	runId = "run-1",
): AgentRunItemEvent => ({
	version: 1,
	eventId: `evt-${sequence}`,
	sequence,
	runId,
	timestamp: "2026-01-01T00:00:00Z",
	type: "item.updated",
	itemId,
	kind: "message",
	delta,
});

const completedEvent = (
	sequence: number,
	item: AgentRunItem,
	runId = "run-1",
): AgentRunItemEvent => ({
	version: 1,
	eventId: `evt-${sequence}`,
	sequence,
	runId,
	timestamp: "2026-01-01T00:00:00Z",
	type: "item.completed",
	item,
});

const newAgent = (runId = "run-1") =>
	new AgentStore("room-1", "insight-1", runId);

beforeEach(() => {
	mockPollAgentRun.mockReset();
	mockGetAgentRun.mockReset();
	mockStreamAgentRun.mockReset();
});

describe("applyAgentRunItemEvent", () => {
	it("adds a started item and ignores a duplicate start", () => {
		const started = startedEvent(1, messageItem("m1", "hello"));
		const once = applyAgentRunItemEvent(
			createAgentRunItemsState(),
			started,
		);
		const twice = applyAgentRunItemEvent(once, started);

		expect(once.itemOrder).toEqual(["m1"]);
		expect(once.itemsById.m1).toEqual(messageItem("m1", "hello"));
		expect(twice).toBe(once);
	});

	it("appends deltas to message text", () => {
		let state = createAgentRunItemsState();
		state = applyAgentRunItemEvent(
			state,
			startedEvent(1, messageItem("m1", "")),
		);
		state = applyAgentRunItemEvent(state, deltaEvent(2, "m1", "Hel"));
		state = applyAgentRunItemEvent(state, deltaEvent(3, "m1", "lo"));

		expect(state.itemsById.m1).toMatchObject({ text: "Hello" });
	});

	it("appends deltas to reasoning summaries", () => {
		let state = createAgentRunItemsState();
		state = applyAgentRunItemEvent(
			state,
			startedEvent(1, { id: "r1", kind: "reasoning", summary: "Th" }),
		);
		state = applyAgentRunItemEvent(state, {
			...deltaEvent(2, "r1", "inking"),
			kind: "reasoning",
		});

		expect(state.itemsById.r1).toMatchObject({ summary: "Thinking" });
	});

	it("ignores an update for an unknown item", () => {
		const state = createAgentRunItemsState();
		const next = applyAgentRunItemEvent(state, deltaEvent(1, "ghost", "x"));

		expect(next).toBe(state);
	});

	it("merges patches onto tool items", () => {
		const tool: AgentRunItem = {
			id: "t1",
			kind: "tool",
			name: "read_file",
			arguments: { path: "a.txt" },
			status: "RUNNING",
		};
		let state = createAgentRunItemsState();
		state = applyAgentRunItemEvent(state, startedEvent(1, tool));
		state = applyAgentRunItemEvent(state, {
			version: 1,
			eventId: "evt-2",
			sequence: 2,
			runId: "run-1",
			timestamp: "2026-01-01T00:00:00Z",
			type: "item.updated",
			itemId: "t1",
			kind: "tool",
			patch: { status: "COMPLETED", output: "done", durationMs: 12 },
		});

		expect(state.itemsById.t1).toMatchObject({
			name: "read_file",
			status: "COMPLETED",
			output: "done",
			durationMs: 12,
		});
	});

	it("replaces the item wholesale on completion without double-appending", () => {
		let state = createAgentRunItemsState();
		state = applyAgentRunItemEvent(
			state,
			startedEvent(1, messageItem("m1", "")),
		);
		state = applyAgentRunItemEvent(state, deltaEvent(2, "m1", "Hello"));
		state = applyAgentRunItemEvent(
			state,
			completedEvent(3, messageItem("m1", "Hello")),
		);

		expect(state.itemsById.m1).toMatchObject({ text: "Hello" });
		expect(state.itemOrder).toEqual(["m1"]);
	});

	it("adds an unseen completed item to the order", () => {
		const state = applyAgentRunItemEvent(
			createAgentRunItemsState(),
			completedEvent(1, messageItem("m9", "full text")),
		);

		expect(state.itemOrder).toEqual(["m9"]);
		expect(state.itemsById.m9).toMatchObject({ text: "full text" });
	});
});

describe("AgentStore.watch", () => {
	it("delivers events in sequence order, dedups replays, and stops after a terminal empty drain", async () => {
		const runId = "sub-order";
		const first = startedEvent(1, messageItem("m1", ""), runId);
		const second = deltaEvent(2, "m1", "Hello", runId);
		mockPollAgentRun
			.mockResolvedValueOnce({
				run: snapshot("RUNNING", runId),
				// Out of order on the wire — must be applied 1 then 2.
				events: [second, first],
				droppedEvents: 0,
			})
			.mockResolvedValueOnce({
				run: snapshot("COMPLETED", runId),
				// A replay of an already-seen event must not re-fire onEvent;
				// the new completion event keeps the terminal tail-drain going.
				events: [
					second,
					completedEvent(3, messageItem("m1", "Hello"), runId),
				],
				droppedEvents: 0,
			})
			.mockResolvedValueOnce({
				run: snapshot("COMPLETED", runId),
				events: [],
				droppedEvents: 0,
			});
		mockGetAgentRun.mockResolvedValue({
			...snapshot("COMPLETED", runId),
			messages: [],
		});

		const seen: AgentRunItemEvent[] = [];
		const reconciles: AgentRunSnapshot[] = [];
		const subscription = newAgent(runId).watch(
			{
				onEvent: (event) => seen.push(event),
				onSnapshot: () => undefined,
				onReconcile: (record) => reconciles.push(record),
			},
			{ pollIntervalMs: 1 },
		);
		const last = await subscription.done;

		expect(seen.map((event) => event.sequence)).toEqual([1, 2, 3]);
		expect(subscription.getItems().itemsById.m1).toMatchObject({
			text: "Hello",
		});
		expect(reconciles).toHaveLength(1);
		expect(reconciles[0].status).toBe("COMPLETED");
		expect(last?.status).toBe("COMPLETED");
		// Terminal drain with events keeps polling; only the empty drain stops.
		expect(mockPollAgentRun).toHaveBeenCalledTimes(3);
	});

	it("surfaces droppedEvents on the snapshot handler", async () => {
		const runId = "sub-dropped";
		mockPollAgentRun.mockResolvedValueOnce({
			run: snapshot("COMPLETED", runId),
			events: [],
			droppedEvents: 4,
		});
		mockGetAgentRun.mockResolvedValue({
			...snapshot("COMPLETED", runId),
			messages: [],
		});

		const metas: { droppedEvents: number }[] = [];
		const subscription = newAgent(runId).watch(
			{
				onEvent: () => undefined,
				onSnapshot: (_snapshot, meta) => metas.push(meta),
				onReconcile: () => undefined,
			},
			{ pollIntervalMs: 1 },
		);
		await subscription.done;

		expect(metas).toEqual([{ droppedEvents: 4 }]);
	});

	it("reconciles on each transition into INPUT_REQUIRED, not on every paused poll", async () => {
		const runId = "sub-pause";
		mockPollAgentRun
			.mockResolvedValueOnce({
				run: snapshot("INPUT_REQUIRED", runId),
				events: [],
				droppedEvents: 0,
			})
			.mockResolvedValueOnce({
				run: snapshot("INPUT_REQUIRED", runId),
				events: [],
				droppedEvents: 0,
			})
			.mockResolvedValueOnce({
				run: snapshot("RUNNING", runId),
				events: [],
				droppedEvents: 0,
			})
			.mockResolvedValueOnce({
				run: snapshot("INPUT_REQUIRED", runId),
				events: [],
				droppedEvents: 0,
			})
			.mockResolvedValueOnce({
				run: snapshot("COMPLETED", runId),
				events: [],
				droppedEvents: 0,
			});
		mockGetAgentRun.mockResolvedValue({
			...snapshot("COMPLETED", runId),
			messages: [],
		});

		const reconciles: AgentRunSnapshot[] = [];
		const subscription = newAgent(runId).watch(
			{
				onEvent: () => undefined,
				onSnapshot: () => undefined,
				onReconcile: (record) => reconciles.push(record),
			},
			{ pollIntervalMs: 1 },
		);
		await subscription.done;

		// Pause, pause (deduped), resume, pause again, terminal.
		expect(reconciles).toHaveLength(3);
	});

	it("returns the same subscription when watch() is called twice on one instance", async () => {
		const runId = "sub-dedup";
		mockPollAgentRun.mockImplementation(
			() =>
				new Promise((resolve) => {
					setTimeout(
						() =>
							resolve({
								run: snapshot("RUNNING", runId),
								events: [],
								droppedEvents: 0,
							}),
						5,
					);
				}),
		);

		const handlers = {
			onEvent: () => undefined,
			onSnapshot: () => undefined,
			onReconcile: () => undefined,
		};
		const agent = newAgent(runId);
		const first = agent.watch(handlers, { pollIntervalMs: 1 });
		const second = agent.watch(handlers, { pollIntervalMs: 1 });

		expect(second).toBe(first);

		agent.stop();
		await first.done;
	});

	it("falls back to a durable reconcile and stops at the failure cap", async () => {
		const runId = "sub-failures";
		mockPollAgentRun.mockRejectedValue(new Error("network down"));
		mockGetAgentRun.mockResolvedValue({
			...snapshot("RUNNING", runId),
			messages: [],
		});

		const errors: Error[] = [];
		const reconciles: AgentRunSnapshot[] = [];
		const subscription = newAgent(runId).watch(
			{
				onEvent: () => undefined,
				onSnapshot: () => undefined,
				onReconcile: (record) => reconciles.push(record),
				onError: (error) => errors.push(error),
			},
			{ pollIntervalMs: 1, maxConsecutiveFailures: 2 },
		);
		const last = await subscription.done;

		expect(errors).toHaveLength(2);
		expect(mockPollAgentRun).toHaveBeenCalledTimes(2);
		expect(mockGetAgentRun).toHaveBeenCalledTimes(1);
		expect(reconciles).toHaveLength(1);
		expect(last?.status).toBe("RUNNING");
	});

	it("stops on abort without touching the run", async () => {
		const runId = "sub-abort";
		mockPollAgentRun.mockResolvedValue({
			run: snapshot("RUNNING", runId),
			events: [],
			droppedEvents: 0,
		});

		const controller = new AbortController();
		const subscription = newAgent(runId).watch(
			{
				onEvent: () => undefined,
				onSnapshot: () => undefined,
				onReconcile: () => undefined,
			},
			{ pollIntervalMs: 1, signal: controller.signal },
		);
		controller.abort();
		const last = await subscription.done;

		expect(last === null || last.status === "RUNNING").toBe(true);
		expect(mockGetAgentRun).not.toHaveBeenCalled();
	});
});

describe("AgentStore.watch with transport: 'sse'", () => {
	/** Minimal fake EventSource-connection controller for streamAgentRun's mock. */
	type FakeConnection = {
		handlers: {
			onRun: (run: AgentRunSnapshot) => void;
			onEvent: (event: AgentRunItemEvent) => void;
			onError?: (error: Event) => void;
		};
		close: ReturnType<typeof vi.fn>;
	};

	const mockStream = (): FakeConnection[] => {
		const connections: FakeConnection[] = [];
		mockStreamAgentRun.mockImplementation((_runId, _after, handlers) => {
			const close = vi.fn();
			connections.push({ handlers, close });
			return { close };
		});
		return connections;
	};

	it("applies live events and resolves done on a terminal run frame", async () => {
		const runId = "sse-terminal";
		const connections = mockStream();
		mockGetAgentRun.mockResolvedValue({
			...snapshot("COMPLETED", runId),
			messages: [],
		});

		const events: AgentRunItemEvent[] = [];
		const reconciles: AgentRunSnapshot[] = [];
		const subscription = newAgent(runId).watch(
			{
				onEvent: (event) => events.push(event),
				onSnapshot: () => undefined,
				onReconcile: (full) => reconciles.push(full),
			},
			{ transport: "sse" },
		);

		expect(mockStreamAgentRun).toHaveBeenCalledWith(
			runId,
			0,
			expect.anything(),
		);
		const connection = connections[0];
		connection.handlers.onEvent(startedEvent(1, messageItem("m1", "hi")));
		connection.handlers.onRun(snapshot("COMPLETED", runId));

		const last = await subscription.done;

		expect(events).toHaveLength(1);
		expect(connection.close).toHaveBeenCalled();
		expect(reconciles).toHaveLength(1);
		expect(reconciles[0].status).toBe("COMPLETED");
		expect(last?.status).toBe("COMPLETED");
		// A terminal run frame must not fall through to the poll loop.
		expect(mockPollAgentRun).not.toHaveBeenCalled();
	});

	it("reopens the connection, carrying the last sequence forward, on an INPUT_REQUIRED pause", async () => {
		const runId = "sse-paused";
		const connections = mockStream();
		mockGetAgentRun.mockResolvedValue({
			...snapshot("INPUT_REQUIRED", runId),
			messages: [],
		});

		const agent = newAgent(runId);
		agent.watch(
			{
				onEvent: () => undefined,
				onSnapshot: () => undefined,
				onReconcile: () => undefined,
			},
			{
				transport: "sse",
				pollIntervalMs: 1,
				inputRequiredIntervalMultiplier: 1,
			},
		);

		await vi.waitFor(() => expect(connections).toHaveLength(1));
		connections[0].handlers.onEvent(
			startedEvent(5, messageItem("m1", "hi")),
		);
		connections[0].handlers.onRun(snapshot("INPUT_REQUIRED", runId));

		// The pause closes connection #1 and, after the retry wait, opens a
		// second one carrying forward the last sequence seen (5) so nothing
		// buffered on the backend between pause and resume is replayed twice
		// or skipped.
		await vi.waitFor(() => expect(connections).toHaveLength(2));
		expect(connections[0].close).toHaveBeenCalled();
		expect(mockStreamAgentRun).toHaveBeenNthCalledWith(
			2,
			runId,
			5,
			expect.anything(),
		);

		agent.stop();
		await agent.done;
	});

	it("falls back to polling after one SSE transport error and never reopens SSE", async () => {
		const runId = "sse-falls-back";
		const connections = mockStream();
		mockPollAgentRun.mockResolvedValue({
			run: snapshot("RUNNING", runId),
			events: [],
			droppedEvents: 0,
		});

		const errors: Error[] = [];
		const agent = newAgent(runId);
		agent.watch(
			{
				onEvent: () => undefined,
				onSnapshot: () => undefined,
				onReconcile: () => undefined,
				onError: (error) => errors.push(error),
			},
			{ transport: "sse", pollIntervalMs: 1 },
		);

		await vi.waitFor(() => expect(connections).toHaveLength(1));
		connections[0].handlers.onError?.(new ErrorEvent("error"));

		// The poll loop should now be driving this subscription — give it a
		// moment to make at least one call.
		await vi.waitFor(() => expect(mockPollAgentRun).toHaveBeenCalled());

		expect(errors).toHaveLength(1);
		expect(connections).toHaveLength(1); // never reopened SSE

		agent.stop();
		await agent.done;
	});
});
