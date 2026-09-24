/**
 * One console's conversation with the agent: the controller both hosts drive.
 *
 * A host draws {@link SessionState} and forwards what the user does - a line
 * submitted, a key pressed, a button clicked - to the methods here. The part
 * in between is here, once: which prompts may start a run, how a run's polls
 * become what is shown, how a stop or a decision reaches the backend, and what
 * to say when any of that fails. The host keeps only what it alone can do:
 * reach its backend, through the {@link SessionBackend} port, and draw.
 *
 * <h4>State</h4>
 *
 * `getState` returns an immutable snapshot and `subscribe` reports a new one,
 * the contract React's `useSyncExternalStore` expects. An update replaces only
 * the entries it changed, and a poll that changed nothing replaces none.
 *
 * <h4>One run at a time</h4>
 *
 * A prompt sent while a run is in progress is refused, not queued, and the
 * host leaves the text in the input for the user to send again. A queue would
 * need an answer for what happens to it when the run ahead of it fails.
 *
 * <h4>Losing a run</h4>
 *
 * `watchAgentRun` settles only when a durable reconcile reports the run over.
 * When polling stops without one - the transport failed too often in a row
 * and the fallback reconcile failed too, or found the run still going - it
 * never settles. So the session does not wait on it. It waits on the store's
 * `done`, which always settles, and a run that has not ended by then is LOST:
 * the console has stopped following it and says so, rather than spinning
 * forever or claiming the run failed.
 *
 * <h4>What the session never does</h4>
 *
 * Cancel a run because the console went away. `dispose` stops polling and
 * leaves the run alone, as closing the tab would. Following that run again
 * later needs a new `AgentStore`: a stopped store cannot be watched twice.
 */

import {
	type AgentRunItemEvent,
	type AgentRunItemsState,
	type AgentRunSnapshot,
	type AgentStore,
	isRequestUserInputAction,
	type PendingAgentAction,
} from "@semoss/sdk";
import { dispatch } from "../commands/dispatch";
import { parseInput } from "../commands/parse";
import {
	type CommandRegistry,
	type CommandSpec,
	createCommandRegistry,
} from "../commands/registry";
import {
	type MessageKey,
	type MessageParams,
	type Translate,
	translateEnglish,
} from "../i18n/messages";
import {
	DEFAULT_KEYMAP,
	type KeyBinding,
	type Platform,
} from "../keymap/keymap";
import {
	type AgentWatchHandlers,
	type AgentWatchOptions,
	registerAgent,
	watchAgentRun,
} from "../run/run-registry";
import { type Emphasis, type Line, textLine } from "../transcript/line";
import { describeError } from "../util/describe-error";
import type { RunEntry, RunStatus, SessionEntry } from "./entries";
import { actionLabel } from "./run-lines";
import { createSessionCommands } from "./session-commands";

export interface HarnessOption {
	/** What the backend calls it, and what a run is started with. */
	name: string;
	/** Translated, for display. */
	label: string;
	description?: string;
	isDefault?: boolean;
}

export interface ModelOption {
	/** The engine id a run is started with. */
	id: string;
	name: string;
}

export interface SessionCatalog {
	harnesses: readonly HarnessOption[];
	models: readonly ModelOption[];
}

/** What a room is saved with, and a run started with. */
export interface RoomSettings {
	harness: string;
	modelId: string;
}

export interface RunRequest extends RoomSettings {
	roomId: string;
	/** The prompt, as typed. */
	command: string;
}

/**
 * The backend, as far as the session needs it.
 *
 * A port rather than SDK calls so the host decides what a room is created
 * with and what else a run carries (an insight, a project), and so the
 * session can be tested without a server.
 */
export interface SessionBackend {
	/** Create a room saved with `settings`, and return its id. */
	createRoom: (settings: RoomSettings) => Promise<string>;
	updateRoom: (roomId: string, settings: RoomSettings) => Promise<void>;
	/**
	 * Submit a run and return its store, not yet watched. The session watches
	 * it, and the drain is destructive: a second poller would take half the
	 * events.
	 */
	startRun: (request: RunRequest) => Promise<AgentStore>;
}

/** A run's raw events, to check the transcript against what the backend really sent. */
export interface RunExport {
	runId: string;
	roomId: string;
	harness: string;
	modelId: string;
	prompt: string;
	/** As they were delivered: sorted, deduplicated, and not yet folded. */
	events: readonly AgentRunItemEvent[];
	/** Delivered after the first {@link EXPORT_EVENT_LIMIT}, and not kept. */
	omittedEvents: number;
	/** Evicted by the backend before the console polled them. */
	droppedEvents: number;
	/** The last snapshot the run reported. */
	snapshot?: AgentRunSnapshot;
}

export interface SessionHost {
	/** The session moved to a room: the one its first prompt created, or none after `:new`. */
	onRoomChange?: (roomId: string | undefined) => void;
	/** Save an export. `:export` is offered only when this is given. */
	saveExport?: (data: RunExport) => void | Promise<void>;
	/** How `:help` names the keys. */
	platform?: Platform;
	/** The keys `:help` lists, when the host binds its own. */
	keymap?: readonly KeyBinding[];
}

export interface SessionOptions {
	backend: SessionBackend;
	host?: SessionHost;
	catalog: SessionCatalog;
	/** The room to continue. Without one, the first prompt creates a room. */
	roomId?: string;
	/**
	 * The harness to start on, normally the room's saved one. The catalog's
	 * default is used instead when it is missing or no longer offered.
	 */
	harness?: string;
	/**
	 * Models to start on, most preferred first: the room's saved model, say,
	 * then the user's default. The first one the catalog still has wins, and
	 * the catalog's first model when none is: a saved model can have been
	 * deleted, or untagged, since.
	 */
	preferredModels?: readonly (string | undefined)[];
	/** A reopened room's earlier turns, from `roomHistoryLines`. */
	history?: readonly Line[];
	translate?: Translate;
	/** More commands, after the built-in ones. */
	commands?: readonly CommandSpec<Session>[];
	watchOptions?: AgentWatchOptions;
	now?: () => number;
}

export interface SessionState {
	roomId?: string;
	/** What the next run starts with. Undefined only when the catalog is empty. */
	harness?: string;
	modelId?: string;
	catalog: SessionCatalog;
	entries: readonly SessionEntry[];
	/** The run in progress, from its prompt until the console stops following it. */
	activeEntryId?: string;
}

export type SubmitResult =
	| { kind: "empty" }
	/** The prompt became the run in `entryId`. */
	| { kind: "started"; entryId: string }
	/** The prompt was not sent, and a notice says why. Give the user the text back. */
	| { kind: "refused" }
	| { kind: "ran"; name: string }
	/** A command failed, or was not one. The session has shown the message already. */
	| { kind: "error"; message: string };

export interface Session {
	getState: () => SessionState;
	subscribe: (listener: () => void) => () => void;
	/** The commands `submit` accepts, built-in ones first. */
	readonly commands: CommandRegistry<Session>;
	readonly translate: Translate;
	submit: (raw: string) => Promise<SubmitResult>;
	/** Stop the run in progress, or say nothing is running. */
	interrupt: () => Promise<void>;
	/** Allow a waiting tool call: `action`, or else the first one waiting. */
	approve: (action?: PendingAgentAction) => Promise<boolean>;
	/** Reject a waiting tool call or question: `action`, or else the first one waiting. */
	deny: (action?: PendingAgentAction) => Promise<boolean>;
	/** Answer a RequestUserInput call with what the user entered in its form. */
	respond: (
		action: PendingAgentAction,
		answers: Record<string, unknown>,
	) => Promise<boolean>;
	/** Switch by name, or by label, ignoring case. */
	setHarness: (name: string) => Promise<boolean>;
	cycleHarness: () => Promise<boolean>;
	/** Switch by id, or by name, ignoring case. */
	setModel: (idOrName: string) => Promise<boolean>;
	/** Leave the room. The next prompt creates another. */
	newRoom: () => boolean;
	/** Clear the screen, keeping the run in progress. */
	clear: () => void;
	notice: (lines: readonly Line[]) => void;
	exportLastRun: () => Promise<void>;
	/** Stop polling. Leaves any run going on the server. */
	dispose: () => void;
}

/**
 * Events kept per run for `:export`. Far more than a run a console can show,
 * and a bound on what a runaway run can hold in memory.
 */
export const EXPORT_EVENT_LIMIT = 20_000;

const EMPTY_ITEMS: AgentRunItemsState = { itemsById: {}, itemOrder: [] };

const isOver = (status: RunStatus) =>
	status === "COMPLETED" ||
	status === "FAILED" ||
	status === "CANCELLED" ||
	status === "LOST";

const sameActions = (
	a: readonly PendingAgentAction[],
	b: readonly PendingAgentAction[],
) =>
	a.length === b.length &&
	a.every((action, index) => action.actionId === b[index].actionId);

/**
 * `next`, or `run` itself when nothing about it differs, so that a poll that
 * brought nothing new does not make the host redraw the run.
 */
const unlessSame = (run: RunEntry, next: RunEntry): RunEntry => {
	const keys = new Set([...Object.keys(run), ...Object.keys(next)]);
	for (const key of keys as Set<keyof RunEntry>) {
		const differs =
			key === "pendingActions"
				? !sameActions(run.pendingActions, next.pendingActions)
				: run[key] !== next[key];
		if (differs) {
			return next;
		}
	}
	return run;
};

/** What the session keeps about a run that nothing draws. */
interface RunControl {
	entryId: string;
	prompt: string;
	settings: RoomSettings;
	agent?: AgentStore;
	/** The items as of the last event, committed with the snapshot that follows it. */
	items?: AgentRunItemsState;
	events: AgentRunItemEvent[];
	omittedEvents: number;
	droppedEvents: number;
	snapshot?: AgentRunSnapshot;
	/**
	 * Actions decided from this console. The backend can report one as pending
	 * for a poll or two after the decision reaches it, and offering it again
	 * would invite a second decision on the same call.
	 */
	decided: Set<string>;
	/** A stop asked for before the backend had a run to stop. */
	stopWhenStarted: boolean;
	cancelling: boolean;
}

export const createSession = (options: SessionOptions): Session => {
	const {
		backend,
		host = {},
		translate = translateEnglish,
		now = Date.now,
		watchOptions,
	} = options;
	const { harnesses, models } = options.catalog;

	let lastId = 0;
	const newId = (prefix: string) => `${prefix}-${++lastId}`;

	let state: SessionState = {
		roomId: options.roomId,
		harness: (
			harnesses.find((option) => option.name === options.harness) ??
			harnesses.find((option) => option.isDefault) ??
			harnesses[0]
		)?.name,
		modelId:
			(options.preferredModels ?? []).find(
				(id) =>
					id !== undefined && models.some((model) => model.id === id),
			) ?? models[0]?.id,
		catalog: options.catalog,
		entries: options.history?.length
			? [
					{
						kind: "history",
						id: newId("history"),
						lines: options.history,
					},
				]
			: [],
	};
	const listeners = new Set<() => void>();
	let disposed = false;
	/** The run in progress. One at a time, which is what makes this a single slot. */
	let active: RunControl | undefined;
	/** The last run the backend accepted, for `:export`. */
	let exportable: RunControl | undefined;
	let saving: Promise<void> = Promise.resolve();

	const commit = (next: SessionState) => {
		if (disposed) {
			return;
		}
		state = next;
		for (const listener of [...listeners]) {
			listener();
		}
	};

	const append = (entry: SessionEntry) =>
		commit({ ...state, entries: [...state.entries, entry] });

	const notice = (lines: readonly Line[]) =>
		append({ kind: "notice", id: newId("notice"), lines });

	const say = (
		key: MessageKey,
		params?: MessageParams,
		emphasis?: Emphasis,
	) => notice([textLine(translate(key, params), emphasis)]);

	const findRun = (entryId: string) =>
		state.entries.find(
			(entry): entry is RunEntry =>
				entry.kind === "run" && entry.id === entryId,
		);

	/**
	 * Replace a run's entry with `update(entry)`. With `end`, the run also
	 * stops being the one in progress, in the same commit, so no host ever sees
	 * a run that has ended but still blocks the prompt.
	 */
	const patchRun = (
		control: RunControl,
		update: (run: RunEntry) => RunEntry,
		end = false,
	) => {
		const ending = end && active === control;
		if (ending) {
			active = undefined;
		}
		let changed = false;
		const entries = state.entries.map((entry) => {
			if (entry.kind !== "run" || entry.id !== control.entryId) {
				return entry;
			}
			const next = update(entry);
			changed = next !== entry;
			return next;
		});
		if (!changed && !ending) {
			return;
		}
		commit({
			...state,
			entries: changed ? entries : state.entries,
			activeEntryId: ending ? undefined : state.activeEntryId,
		});
	};

	const pendingOf = (control: RunControl, snapshot: AgentRunSnapshot) =>
		(snapshot.pendingActions ?? []).filter(
			(action) => !control.decided.has(action.actionId),
		);

	const refuseWhileBusy = () => {
		if (active === undefined) {
			return false;
		}
		say("session.busy", undefined, "error");
		return true;
	};

	const follow = (control: RunControl, agent: AgentStore) => {
		const handlers: AgentWatchHandlers = {
			onEvent: (event, items) => {
				control.items = items;
				if (control.events.length < EXPORT_EVENT_LIMIT) {
					control.events.push(event);
				} else {
					control.omittedEvents++;
				}
			},
			onSnapshot: (snapshot, { droppedEvents }) => {
				control.snapshot = snapshot;
				control.droppedEvents += droppedEvents;
				patchRun(control, (run) =>
					unlessSame(run, {
						...run,
						items: control.items ?? run.items,
						status: snapshot.status,
						pendingActions: pendingOf(control, snapshot),
						droppedEvents: control.droppedEvents,
						finalText: snapshot.finalText ?? run.finalText,
						errorMessage: snapshot.errorMessage ?? run.errorMessage,
						transportError: undefined,
					}),
				);
			},
			onReconcile: (snapshot) => {
				control.snapshot = snapshot;
				const over = isOver(snapshot.status);
				patchRun(
					control,
					(run) => ({
						...run,
						status: snapshot.status,
						pendingActions: over
							? []
							: pendingOf(control, snapshot),
						finalText: snapshot.finalText ?? run.finalText,
						errorMessage: snapshot.errorMessage ?? run.errorMessage,
						...(over
							? { transportError: undefined, endedAt: now() }
							: {}),
					}),
					over,
				);
			},
			onError: (error) => {
				patchRun(control, (run) =>
					unlessSame(run, {
						...run,
						transportError: describeError(error),
					}),
				);
			},
		};
		// Rejects when the run ends FAILED or CANCELLED, which onReconcile has
		// already shown, and never settles when the run is lost (see above).
		watchAgentRun(agent, handlers, watchOptions).catch(() => {});
		// Read only after watching: before, `done` is a promise already
		// resolved, and every run would look lost at once.
		void agent.done.then(() => {
			patchRun(
				control,
				(run) =>
					run.endedAt !== undefined
						? run
						: {
								...run,
								status: isOver(run.status)
									? run.status
									: "LOST",
								pendingActions: [],
								transportError: undefined,
								endedAt: now(),
							},
				true,
			);
		});
	};

	const cancel = async (control: RunControl) => {
		const { agent } = control;
		if (agent === undefined || control.cancelling) {
			return;
		}
		control.cancelling = true;
		try {
			await agent.cancel();
			agent.pokeNow();
		} catch (error) {
			// A run that ended meanwhile is why the stop failed, and it needs no
			// explaining.
			const run = findRun(control.entryId);
			if (run?.endedAt === undefined && !isOver(run?.status ?? "LOST")) {
				patchRun(control, (run) => ({ ...run, stopRequested: false }));
				say(
					"session.stopFailed",
					{ message: describeError(error) },
					"error",
				);
			}
		} finally {
			control.cancelling = false;
		}
	};

	const launch = async (control: RunControl) => {
		let agent: AgentStore;
		try {
			let { roomId } = state;
			if (roomId === undefined) {
				roomId = await backend.createRoom(control.settings);
				if (disposed) {
					return;
				}
				commit({ ...state, roomId });
				host.onRoomChange?.(roomId);
			}
			agent = await backend.startRun({
				...control.settings,
				roomId,
				command: control.prompt,
			});
		} catch (error) {
			patchRun(
				control,
				(run) => ({
					...run,
					status: "FAILED",
					startError: describeError(error),
					endedAt: now(),
				}),
				true,
			);
			return;
		}
		if (disposed) {
			return;
		}
		control.agent = agent;
		exportable = control;
		registerAgent(agent);
		patchRun(control, (run) => ({
			...run,
			runId: agent.runId,
			status: "SUBMITTED",
		}));
		follow(control, agent);
		if (control.stopWhenStarted) {
			await cancel(control);
		}
	};

	const startRun = (prompt: string): SubmitResult => {
		if (refuseWhileBusy()) {
			return { kind: "refused" };
		}
		const { harness, modelId } = state;
		if (modelId === undefined) {
			say("session.noModel", undefined, "error");
			return { kind: "refused" };
		}
		if (harness === undefined) {
			say("session.noHarness", undefined, "error");
			return { kind: "refused" };
		}
		const control: RunControl = {
			entryId: newId("run"),
			prompt,
			settings: { harness, modelId },
			events: [],
			omittedEvents: 0,
			droppedEvents: 0,
			decided: new Set(),
			stopWhenStarted: false,
			cancelling: false,
		};
		active = control;
		commit({
			...state,
			entries: [
				...state.entries,
				{
					kind: "run",
					id: control.entryId,
					prompt,
					harness,
					modelId,
					status: "STARTING",
					items: EMPTY_ITEMS,
					droppedEvents: 0,
					pendingActions: [],
					startedAt: now(),
				},
			],
			activeEntryId: control.entryId,
		});
		void launch(control);
		return { kind: "started", entryId: control.entryId };
	};

	/**
	 * Send a decision on a waiting action. It disappears from the run at once,
	 * so it cannot be decided twice, and comes back if the backend refuses.
	 */
	const decide = async (
		action: PendingAgentAction,
		decision: "submit" | "reject" | "respond",
		paramValues?: Record<string, unknown>,
	): Promise<boolean> => {
		const control = active;
		const run = control && findRun(control.entryId);
		const agent = control?.agent;
		if (
			control === undefined ||
			agent === undefined ||
			!run?.pendingActions.some((a) => a.actionId === action.actionId)
		) {
			say("session.nothingPending", undefined, "dim");
			return false;
		}
		control.decided.add(action.actionId);
		patchRun(control, (current) => ({
			...current,
			pendingActions: current.pendingActions.filter(
				(a) => a.actionId !== action.actionId,
			),
		}));
		try {
			await agent.decide(action, decision, paramValues);
			return true;
		} catch (error) {
			control.decided.delete(action.actionId);
			const { snapshot } = control;
			patchRun(control, (current) =>
				current.endedAt !== undefined || snapshot === undefined
					? current
					: {
							...current,
							pendingActions: pendingOf(control, snapshot),
						},
			);
			say(
				"session.decisionFailed",
				{ message: describeError(error) },
				"error",
			);
			return false;
		}
	};

	const activeRun = () =>
		active === undefined ? undefined : findRun(active.entryId);

	const save = () => {
		saving = saving.then(async () => {
			// Read when the save runs, not when it was asked for, so the last
			// save to land carries the last switch.
			const { roomId, harness, modelId } = state;
			if (
				disposed ||
				roomId === undefined ||
				harness === undefined ||
				modelId === undefined
			) {
				return;
			}
			try {
				await backend.updateRoom(roomId, { harness, modelId });
			} catch (error) {
				say(
					"session.saveFailed",
					{ message: describeError(error) },
					"error",
				);
			}
		});
		return saving;
	};

	const switchTo = async (
		patch: Partial<RoomSettings>,
		label: string,
	): Promise<boolean> => {
		const harness = patch.harness ?? state.harness;
		const modelId = patch.modelId ?? state.modelId;
		if (harness === state.harness && modelId === state.modelId) {
			return true;
		}
		commit({
			...state,
			harness,
			modelId,
			entries: [
				...state.entries,
				{
					kind: "notice",
					id: newId("notice"),
					lines: [{ kind: "divider", label }],
				},
			],
		});
		// The switch stands locally even if saving it fails: the next run
		// starts with it either way, and the notice says the room did not keep
		// it.
		await save();
		return true;
	};

	const setHarness = async (name: string) => {
		if (refuseWhileBusy()) {
			return false;
		}
		const wanted = name.trim().toLowerCase();
		const { harnesses: offered } = state.catalog;
		const match =
			offered.find((option) => option.name.toLowerCase() === wanted) ??
			offered.find((option) => option.label.toLowerCase() === wanted);
		if (match === undefined) {
			say("session.unknownHarness", { name: name.trim() }, "error");
			return false;
		}
		return switchTo(
			{ harness: match.name },
			translate("session.harnessChanged", { name: match.label }),
		);
	};

	const setModel = async (idOrName: string) => {
		if (refuseWhileBusy()) {
			return false;
		}
		const wanted = idOrName.trim();
		const { models: offered } = state.catalog;
		const match =
			offered.find((model) => model.id === wanted) ??
			offered.find(
				(model) => model.name.toLowerCase() === wanted.toLowerCase(),
			);
		if (match === undefined) {
			say("session.unknownModel", { name: wanted }, "error");
			return false;
		}
		return switchTo(
			{ modelId: match.id },
			translate("session.modelChanged", { name: match.name }),
		);
	};

	const session: Session = {
		getState: () => state,
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		commands: createCommandRegistry<Session>([
			...createSessionCommands({
				keymap: host.keymap ?? DEFAULT_KEYMAP,
				platform: host.platform,
				canExport: host.saveExport !== undefined,
			}),
			...(options.commands ?? []),
		]),
		translate,

		submit: async (raw) => {
			const input = parseInput(raw);
			if (input.kind === "empty") {
				return input;
			}
			if (input.kind === "prompt") {
				return startRun(input.text);
			}
			append({ kind: "input", id: newId("input"), text: raw.trim() });
			const result = await dispatch(session.commands, session, raw, {
				translate,
			});
			if (result.kind === "error") {
				notice([textLine(result.message, "error")]);
			}
			return result.kind === "prompt" ? startRun(result.text) : result;
		},

		interrupt: async () => {
			const control = active;
			const run = activeRun();
			// A run whose status is already final is only draining its last
			// events, and there is nothing left to stop.
			if (
				control === undefined ||
				run === undefined ||
				isOver(run.status)
			) {
				say("session.nothingRunning", undefined, "dim");
				return;
			}
			patchRun(control, (run) =>
				run.stopRequested ? run : { ...run, stopRequested: true },
			);
			if (control.agent === undefined) {
				control.stopWhenStarted = true;
				return;
			}
			await cancel(control);
		},

		approve: async (action) => {
			const run = activeRun();
			const waiting = run?.pendingActions ?? [];
			const target =
				action ?? waiting.find((a) => !isRequestUserInputAction(a));
			if (target === undefined && waiting.length === 0) {
				say("session.nothingPending", undefined, "dim");
				return false;
			}
			// A question is answered, not approved: approving it would send the
			// tool's own arguments back as the answer.
			if (target === undefined || isRequestUserInputAction(target)) {
				say("session.answerInForm");
				return false;
			}
			const tool = run ? actionLabel(target, run.items) : target.actionId;
			if (!(await decide(target, "submit"))) {
				return false;
			}
			say("session.approved", { tool }, "dim");
			return true;
		},

		deny: async (action) => {
			const run = activeRun();
			const target = action ?? run?.pendingActions[0];
			if (target === undefined) {
				say("session.nothingPending", undefined, "dim");
				return false;
			}
			const tool = run ? actionLabel(target, run.items) : target.actionId;
			if (!(await decide(target, "reject"))) {
				return false;
			}
			say("session.denied", { tool }, "dim");
			return true;
		},

		respond: (action, answers) => decide(action, "respond", answers),

		setHarness,

		cycleHarness: async () => {
			const { harnesses: offered } = state.catalog;
			if (offered.length < 2) {
				return false;
			}
			const index = offered.findIndex(
				(option) => option.name === state.harness,
			);
			return setHarness(offered[(index + 1) % offered.length].name);
		},

		setModel,

		newRoom: () => {
			if (refuseWhileBusy()) {
				return false;
			}
			exportable = undefined;
			commit({ ...state, roomId: undefined, entries: [] });
			host.onRoomChange?.(undefined);
			say("session.newRoom", undefined, "dim");
			return true;
		},

		clear: () =>
			commit({
				...state,
				entries: state.entries.filter(
					(entry) =>
						entry.kind === "run" &&
						entry.id === state.activeEntryId,
				),
			}),

		notice,

		exportLastRun: async () => {
			const control = exportable;
			const agent = control?.agent;
			if (control === undefined || agent === undefined) {
				say("session.nothingToExport", undefined, "dim");
				return;
			}
			if (host.saveExport === undefined) {
				return;
			}
			await host.saveExport({
				runId: agent.runId,
				roomId: agent.roomId,
				harness: control.settings.harness,
				modelId: control.settings.modelId,
				prompt: control.prompt,
				events: [...control.events],
				omittedEvents: control.omittedEvents,
				droppedEvents: control.droppedEvents,
				snapshot: control.snapshot,
			});
			say("session.exported", { runId: agent.runId }, "dim");
		},

		dispose: () => {
			if (disposed) {
				return;
			}
			disposed = true;
			listeners.clear();
			active?.agent?.stop();
		},
	};
	return session;
};

/** The harness the next run starts with, for a status bar. */
export const currentHarness = (state: SessionState) =>
	state.catalog.harnesses.find((option) => option.name === state.harness);

/** The model the next run starts with, for a status bar. */
export const currentModel = (state: SessionState) =>
	state.catalog.models.find((model) => model.id === state.modelId);

/** The run in progress, if there is one. */
export const activeRunEntry = (state: SessionState) =>
	state.entries.find(
		(entry): entry is RunEntry =>
			entry.kind === "run" && entry.id === state.activeEntryId,
	);
