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
 * <h4>Subagents</h4>
 *
 * A host that can follow a run by its id passes `followRun`, and the session
 * then follows each subagent a run spawns through a store of its own, drawn
 * under the subagent's line: a tree, to {@link MAX_SUBAGENT_DEPTH} levels and
 * {@link MAX_FOLLOWED_SUBAGENTS} runs at once unless the host says otherwise.
 * It follows one until it ends, not until its parent does. A parent that
 * completes leaves its subagents running on the server, and one of them can
 * still stop to ask for approval, so its waiting calls are offered with the
 * rest, named by the subagents they are under. A decision goes to the store
 * of the run that lists the call. Only the prompt's own run blocks the prompt,
 * and only it is exported.
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
import { subagentLabel } from "../transcript/transcript";
import { describeError } from "../util/describe-error";
import { escapeInvisibleInJson } from "../util/invisible";
import type {
	RunEntry,
	RunProgress,
	RunStatus,
	SessionEntry,
	SubagentProgress,
	SubagentRun,
} from "./entries";
import {
	actionLabel,
	SUBAGENT_PATH_SEPARATOR,
	type WaitingAction,
	waitingIn,
} from "./run-lines";
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
	/**
	 * A store for a subagent's run, not yet watched, for a host that can follow
	 * a run it did not start. Without it, a subagent is drawn only as far as
	 * its parent reports it. `roomId` is the subagent's own room.
	 */
	followRun?: (run: { runId: string; roomId: string }) => AgentStore;
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
	/**
	 * How deep, and how many subagent runs at once, the session follows when
	 * the backend has `followRun`: {@link MAX_SUBAGENT_DEPTH} and
	 * {@link MAX_FOLLOWED_SUBAGENTS} by default.
	 */
	subagents?: { maxDepth?: number; maxFollowed?: number };
	now?: () => number;
}

/** A tool whose later calls are automatically approved without asking. */
export interface AllowedTool {
	toolName: string;
	label: string;
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
	/**
	 * Tools approved with Always allow, whose later calls this session approves
	 * without asking. Kept in memory only, so a reload forgets them.
	 */
	alwaysAllowed: readonly AllowedTool[];
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
	/**
	 * Stop the run in progress. When there is none, stop the subagents still
	 * running that an earlier run left behind, or say nothing is running.
	 */
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
	/** Approve it, then stop asking about its tool for this session. */
	alwaysAllow: (action?: PendingAgentAction) => Promise<boolean>;
	/** Ask about a tool again, or about every tool when none is named. */
	revoke: (tool?: string) => boolean;
	/**
	 * The `:edit` text that puts a waiting call's arguments in the prompt, for a
	 * host to fill it with. Remembers the call.
	 */
	startEdit: (action?: PendingAgentAction) => string | undefined;
	/** Approve the waiting call with these arguments. */
	edit: (json: string) => Promise<boolean>;
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

/**
 * How many levels of subagents the session follows by default: a prompt's
 * run's own subagents are the first. The backend lets only the first spawn by
 * default, so the rest is headroom, and a bound on a runaway tree.
 */
export const MAX_SUBAGENT_DEPTH = 3;

/**
 * How many subagent runs the session follows at once by default, across every
 * run. Each is polled on its own, so this bounds the requests a console makes.
 */
export const MAX_FOLLOWED_SUBAGENTS = 8;

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
const unlessSame = <P extends RunProgress>(run: P, next: P): P => {
	const keys = new Set([...Object.keys(run), ...Object.keys(next)]);
	for (const key of keys as Set<keyof P>) {
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

/**
 * `since`, with `at` for each tool the items show running that it has no time
 * for yet. It is `since` itself when there is none, so that a poll that
 * brought nothing new does not make the host redraw the run.
 */
const noteRunning = (
	since: Readonly<Record<string, number>>,
	items: AgentRunItemsState | undefined,
	at: number,
): Readonly<Record<string, number>> => {
	let next: Record<string, number> | undefined;
	for (const id of items?.itemOrder ?? []) {
		const item = items?.itemsById[id];
		if (
			item?.kind === "tool" &&
			item.status === "RUNNING" &&
			since[id] === undefined
		) {
			next ??= { ...since };
			next[id] = at;
		}
	}
	return next ?? since;
};

/** What changes about a run, or undefined when nothing does. */
type Changes = (run: RunProgress) => Partial<RunProgress> | undefined;

/** The run at `path` under `run`, which is `run` itself for an empty path. */
const progressAt = (
	run: RunProgress,
	path: readonly string[],
): RunProgress | undefined => {
	let at: RunProgress = run;
	for (const runId of path) {
		const record = at.subagents?.[runId];
		if (!record?.followed) {
			return undefined;
		}
		at = record;
	}
	return at;
};

/**
 * `run` with `changes` made to the run at `path` under it. It is `run` itself
 * when they change nothing, or when there is no longer a run there, so that
 * a poll that brought nothing new does not make the host redraw the entry.
 */
const updateAt = <P extends RunProgress>(
	run: P,
	path: readonly string[],
	changes: Changes,
): P => {
	if (path.length === 0) {
		const next = changes(run);
		return next === undefined ? run : unlessSame(run, { ...run, ...next });
	}
	const [runId, ...rest] = path;
	const record = run.subagents?.[runId];
	if (!record?.followed) {
		return run;
	}
	const updated = updateAt(record, rest, changes);
	return updated === record
		? run
		: { ...run, subagents: { ...run.subagents, [runId]: updated } };
};

/** What the session keeps about a run it follows that nothing draws. */
interface Followed {
	/** The entry the run is drawn in. */
	entryId: string;
	/**
	 * The subagent run ids from the entry's run down to this one: none for the
	 * run a prompt started, one for its subagent, and so on.
	 */
	path: readonly string[];
	/** The labels of the subagents along `path`, to name a call this run waits on. */
	labels: readonly string[];
	agent?: AgentStore;
	/** The items as of the last event, committed with the snapshot that follows it. */
	items?: AgentRunItemsState;
	/**
	 * When each tool was first drawn running: at the snapshot that committed
	 * it, since the items are drawn then and not before.
	 */
	runningSince: Readonly<Record<string, number>>;
	droppedEvents: number;
	snapshot?: AgentRunSnapshot;
	/**
	 * Actions decided from this console. The backend can report one as pending
	 * for a poll or two after the decision reaches it, and offering it again
	 * would invite a second decision on the same call.
	 */
	decided: Set<string>;
	/**
	 * Actions this console has tried to approve on its own. Each is tried once,
	 * and if the backend refuses it, it waits for the user.
	 */
	autoTried: Set<string>;
	cancelling: boolean;
}

/** A run a prompt started. */
interface RunControl extends Followed {
	prompt: string;
	settings: RoomSettings;
	events: AgentRunItemEvent[];
	omittedEvents: number;
	/** A stop asked for before the backend had a run to stop. */
	stopWhenStarted: boolean;
}

const isPromptRun = (control: Followed): control is RunControl =>
	control.path.length === 0;

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
		alwaysAllowed: [],
	};
	const listeners = new Set<() => void>();
	let disposed = false;
	/** The run in progress. One at a time, which is what makes this a single slot. */
	let active: RunControl | undefined;
	/**
	 * Every run the session follows: the one in progress, and subagents, which
	 * can outlive their parent. A run leaves when the session stops following
	 * it, and anything its store reports after that is ignored.
	 */
	const controls = new Set<Followed>();
	const maxDepth = options.subagents?.maxDepth ?? MAX_SUBAGENT_DEPTH;
	const maxFollowed =
		options.subagents?.maxFollowed ?? MAX_FOLLOWED_SUBAGENTS;
	/** The last run the backend accepted, for `:export`. */
	let exportable: RunControl | undefined;
	let saving: Promise<void> = Promise.resolve();
	/** The actionId `startEdit` last filled the prompt for. */
	let editTarget: string | undefined;

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

	/** What `control` draws: its entry's run, or a subagent's record in it. */
	const progressOf = (control: Followed) => {
		const entry = findRun(control.entryId);
		return entry === undefined
			? undefined
			: progressAt(entry, control.path);
	};

	/**
	 * Replace a run's entry with `update(entry)`. With `end`, the session stops
	 * following the run, and a prompt's run stops being the one in progress, in
	 * the same commit, so no host ever sees a run that has ended but still
	 * blocks the prompt.
	 */
	const replace = (
		control: Followed,
		update: (entry: RunEntry) => RunEntry,
		end: boolean,
	) => {
		if (end) {
			controls.delete(control);
		}
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

	/** Change the run `control` draws, wherever in its entry's tree it is. */
	const patch = (control: Followed, changes: Changes, end = false) =>
		replace(
			control,
			(entry) => updateAt(entry, control.path, changes),
			end,
		);

	const pendingOf = (control: Followed, snapshot: AgentRunSnapshot) =>
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

	/**
	 * Decide about each subagent in `control`'s items that has no record yet:
	 * follow it through a store of its own, or say why not. Each is decided
	 * once, whatever its status: one that has already ended still has steps to
	 * show while the server keeps its events.
	 */
	const discover = (
		control: Followed,
	): { records?: Record<string, SubagentRun>; followed: Followed[] } => {
		const followed: Followed[] = [];
		const { followRun } = backend;
		const { items } = control;
		const run = progressOf(control);
		if (
			followRun === undefined ||
			items === undefined ||
			run === undefined
		) {
			return { followed };
		}
		let records: Record<string, SubagentRun> | undefined;
		let live = [...controls].filter((each) => !isPromptRun(each)).length;
		for (const id of items.itemOrder) {
			const item = items.itemsById[id];
			if (
				item?.kind !== "subagent" ||
				run.subagents?.[item.childRunId] !== undefined ||
				records?.[item.childRunId] !== undefined
			) {
				continue;
			}
			records ??= {};
			if (control.path.length >= maxDepth) {
				records[item.childRunId] = {
					followed: false,
					reason: "depth",
					limit: maxDepth,
				};
				continue;
			}
			if (live >= maxFollowed) {
				records[item.childRunId] = {
					followed: false,
					reason: "limit",
					limit: maxFollowed,
				};
				continue;
			}
			let agent: AgentStore;
			try {
				agent = followRun({
					runId: item.childRunId,
					roomId: item.roomId,
				});
			} catch (error) {
				records[item.childRunId] = {
					followed: false,
					reason: "failed",
					message: describeError(error),
				};
				continue;
			}
			registerAgent(agent);
			const child: Followed = {
				entryId: control.entryId,
				path: [...control.path, item.childRunId],
				labels: [...control.labels, subagentLabel(item, translate)],
				agent,
				runningSince: {},
				droppedEvents: 0,
				decided: new Set(),
				autoTried: new Set(),
				cancelling: false,
			};
			controls.add(child);
			live++;
			followed.push(child);
			records[item.childRunId] = {
				followed: true,
				runId: item.childRunId,
				status: "STARTING",
				items: EMPTY_ITEMS,
				droppedEvents: 0,
				pendingActions: [],
				runningSince: child.runningSince,
			} satisfies SubagentProgress;
		}
		return { records, followed };
	};

	const watch = (control: Followed, agent: AgentStore) => {
		// Every handler first checks that the session still follows the run:
		// once it has ended, or the room was left, nothing more is drawn.
		const handlers: AgentWatchHandlers = {
			onEvent: (event, items) => {
				if (!controls.has(control)) {
					return;
				}
				control.items = items;
				// `:export` is the prompt's run's, so only its events are kept.
				if (!isPromptRun(control)) {
					return;
				}
				if (control.events.length < EXPORT_EVENT_LIMIT) {
					control.events.push(event);
				} else {
					control.omittedEvents++;
				}
			},
			onSnapshot: (snapshot, { droppedEvents }) => {
				if (!controls.has(control)) {
					return;
				}
				control.snapshot = snapshot;
				control.droppedEvents += droppedEvents;
				control.runningSince = noteRunning(
					control.runningSince,
					control.items,
					now(),
				);
				const allowed = takeAllowed(
					control,
					pendingOf(control, snapshot),
				);
				const { records, followed } = discover(control);
				patch(control, (run) => ({
					items: control.items ?? run.items,
					status: snapshot.status,
					pendingActions: pendingOf(control, snapshot),
					droppedEvents: control.droppedEvents,
					runningSince: control.runningSince,
					finalText: snapshot.finalText ?? run.finalText,
					errorMessage: snapshot.errorMessage ?? run.errorMessage,
					transportError: undefined,
					...(records === undefined
						? {}
						: { subagents: { ...run.subagents, ...records } }),
				}));
				// Watched once their records are drawn, for their polls to land in.
				for (const child of followed) {
					if (child.agent !== undefined) {
						watch(child, child.agent);
					}
				}
				approveAllowed(control, agent, allowed);
			},
			onReconcile: (snapshot) => {
				if (!controls.has(control)) {
					return;
				}
				control.snapshot = snapshot;
				const over = isOver(snapshot.status);
				const allowed = over
					? []
					: takeAllowed(control, pendingOf(control, snapshot));
				patch(
					control,
					(run) => ({
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
				approveAllowed(control, agent, allowed);
			},
			onError: (error) => {
				if (!controls.has(control)) {
					return;
				}
				patch(control, () => ({
					transportError: describeError(error),
				}));
			},
		};
		// Rejects when the run ends FAILED or CANCELLED, which onReconcile has
		// already shown, and never settles when the run is lost (see above).
		watchAgentRun(agent, handlers, watchOptions).catch(() => {});
		// Read only after watching: before, `done` is a promise already
		// resolved, and every run would look lost at once.
		void agent.done.then(() => {
			if (!controls.has(control)) {
				return;
			}
			patch(
				control,
				(run) =>
					run.endedAt !== undefined
						? undefined
						: {
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

	const cancel = async (control: Followed) => {
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
			const run = progressOf(control);
			if (run?.endedAt === undefined && !isOver(run?.status ?? "LOST")) {
				patch(control, () => ({ stopRequested: false }));
				const message = describeError(error);
				if (isPromptRun(control)) {
					say("session.stopFailed", { message }, "error");
				} else {
					say(
						"session.stopSubagentFailed",
						{
							subagent: control.labels.join(
								SUBAGENT_PATH_SEPARATOR,
							),
							message,
						},
						"error",
					);
				}
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
			replace(
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
		patch(control, () => ({ runId: agent.runId, status: "SUBMITTED" }));
		watch(control, agent);
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
			path: [],
			labels: [],
			prompt,
			settings: { harness, modelId },
			runningSince: {},
			events: [],
			omittedEvents: 0,
			droppedEvents: 0,
			decided: new Set(),
			autoTried: new Set(),
			stopWhenStarted: false,
			cancelling: false,
		};
		active = control;
		controls.add(control);
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
					runningSince: control.runningSince,
					startedAt: now(),
				},
			],
			activeEntryId: control.entryId,
		});
		void launch(control);
		return { kind: "started", entryId: control.entryId };
	};

	/**
	 * Send a decision on an action already taken off the waiting list. If the
	 * backend refuses it, the action is offered again, unless the run has
	 * ended, and the error comes back for the caller to explain.
	 */
	const send = async (
		control: Followed,
		agent: AgentStore,
		action: PendingAgentAction,
		decision: "submit" | "reject" | "respond",
		paramValues?: Record<string, unknown>,
	): Promise<{ ok: true } | { ok: false; error: unknown }> => {
		try {
			await agent.decide(action, decision, paramValues);
			return { ok: true };
		} catch (error) {
			control.decided.delete(action.actionId);
			const { snapshot } = control;
			patch(control, (current) =>
				current.endedAt !== undefined || snapshot === undefined
					? undefined
					: { pendingActions: pendingOf(control, snapshot) },
			);
			return { ok: false, error };
		}
	};

	/**
	 * Take the waiting actions that qualify for automatic approval.
	 *
	 * They are taken before the run is drawn, so an always-allowed call never
	 * shows as waiting: no card flashes, and the announcer never announces it.
	 */
	const takeAllowed = (
		control: Followed,
		waiting: readonly PendingAgentAction[],
	): PendingAgentAction[] => {
		const allowed: PendingAgentAction[] = [];
		for (const action of waiting) {
			if (
				!isRequestUserInputAction(action) &&
				!action.hasUi &&
				typeof action.toolName === "string" &&
				action.toolName !== "" &&
				state.alwaysAllowed.some(
					(entry) => entry.toolName === action.toolName,
				) &&
				!control.autoTried.has(action.actionId)
			) {
				control.decided.add(action.actionId);
				control.autoTried.add(action.actionId);
				allowed.push(action);
			}
		}
		return allowed;
	};

	/**
	 * Approve each allowed action automatically.
	 *
	 * A success is silent: the call's own line shows it ran, and a notice for
	 * each would pile up under the run, away from the call it is about. A
	 * failure says so: the call is shown waiting again, and the next poll does
	 * not retry it.
	 */
	const approveAllowed = (
		control: Followed,
		agent: AgentStore,
		actions: readonly PendingAgentAction[],
	) => {
		for (const action of actions) {
			const run = progressOf(control);
			const label = [
				...control.labels,
				run ? actionLabel(action, run.items) : action.actionId,
			].join(SUBAGENT_PATH_SEPARATOR);
			void send(control, agent, action, "submit").then((result) => {
				if (!result.ok) {
					say(
						"session.autoApproveFailed",
						{ tool: label, message: describeError(result.error) },
						"error",
					);
				}
			});
		}
	};

	/** The run that lists `actionId` as waiting, which is the run the call is in. */
	const waitingControl = (actionId: string) =>
		[...controls].find((control) =>
			progressOf(control)?.pendingActions.some(
				(action) => action.actionId === actionId,
			),
		);

	/**
	 * Send a decision on a waiting action, to the store of the run it waits in.
	 * It disappears from the run at once, so it cannot be decided twice, and
	 * comes back if the backend refuses.
	 */
	const decide = async (
		action: PendingAgentAction,
		decision: "submit" | "reject" | "respond",
		paramValues?: Record<string, unknown>,
	): Promise<boolean> => {
		const control = waitingControl(action.actionId);
		const agent = control?.agent;
		if (control === undefined || agent === undefined) {
			say("session.nothingPending", undefined, "dim");
			return false;
		}
		control.decided.add(action.actionId);
		patch(control, (current) => ({
			pendingActions: current.pendingActions.filter(
				(a) => a.actionId !== action.actionId,
			),
		}));
		const result = await send(
			control,
			agent,
			action,
			decision,
			paramValues,
		);
		if (!result.ok) {
			say(
				"session.decisionFailed",
				{ message: describeError(result.error) },
				"error",
			);
			return false;
		}
		return true;
	};

	const activeRun = () =>
		active === undefined ? undefined : findRun(active.entryId);

	/**
	 * The waiting call a key or a command decides: the one given, or else the
	 * first that is not a question. Says why there is none.
	 */
	const approvalTarget = (
		action?: PendingAgentAction,
	): WaitingAction | undefined => {
		const waiting = waitingActions(state, translate);
		const target =
			action === undefined
				? (waiting.find(
						(each) => !isRequestUserInputAction(each.action),
					) ?? waiting[0])
				: waiting.find(
						(each) => each.action.actionId === action.actionId,
					);
		if (target === undefined) {
			say("session.nothingPending", undefined, "dim");
			return undefined;
		}
		// A question is answered, not approved: approving it would send the
		// tool's own arguments back as the answer.
		if (isRequestUserInputAction(target.action)) {
			say("session.answerInForm");
			return undefined;
		}
		return target;
	};

	/**
	 * The call `edit` sends: the one `startEdit` last filled the prompt for,
	 * or, when the user typed `:edit` without it, the keyed approval. When the
	 * call being edited no longer waits, nothing is sent, rather than the
	 * edited arguments going to a different call.
	 */
	const editedCall = () => {
		if (editTarget === undefined) {
			return approvalTarget();
		}
		const target = waitingActions(state, translate).find(
			(each) => each.action.actionId === editTarget,
		);
		if (target === undefined) {
			editTarget = undefined;
			say("session.editGone", undefined, "error");
			return undefined;
		}
		return target;
	};

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
			// events, and there is nothing left to stop in it. Stopping a run
			// stops its subagents too, on the server.
			if (
				control !== undefined &&
				run !== undefined &&
				!isOver(run.status)
			) {
				patch(control, () => ({ stopRequested: true }));
				if (control.agent === undefined) {
					control.stopWhenStarted = true;
					return;
				}
				await cancel(control);
				return;
			}
			// Subagents a finished run left running have only their own stores.
			const running = [...controls].filter((each) => {
				const progress = progressOf(each);
				return (
					!isPromptRun(each) &&
					progress !== undefined &&
					!isOver(progress.status)
				);
			});
			if (running.length === 0) {
				say("session.nothingRunning", undefined, "dim");
				return;
			}
			for (const each of running) {
				patch(each, () => ({ stopRequested: true }));
			}
			await Promise.all(running.map((each) => cancel(each)));
		},

		approve: async (action) => {
			const found = approvalTarget(action);
			if (found === undefined) {
				return false;
			}
			if (!(await decide(found.action, "submit"))) {
				return false;
			}
			say("session.approved", { tool: found.label }, "dim");
			return true;
		},

		deny: async (action) => {
			const waiting = waitingActions(state, translate);
			const target =
				action === undefined
					? waiting[0]
					: waiting.find(
							(each) => each.action.actionId === action.actionId,
						);
			if (target === undefined) {
				say("session.nothingPending", undefined, "dim");
				return false;
			}
			if (!(await decide(target.action, "reject"))) {
				return false;
			}
			say("session.denied", { tool: target.label }, "dim");
			return true;
		},

		respond: (action, answers) => decide(action, "respond", answers),

		alwaysAllow: async (action) => {
			const found = approvalTarget(action);
			if (found === undefined) {
				return false;
			}
			// What is allowed is the tool, wherever it is called, so the notices
			// name the tool alone rather than the call.
			const { action: target, tool } = found;
			const { toolName } = target;
			if (target.hasUi || !toolName) {
				say("session.cannotAlwaysAllow", { tool });
				return false;
			}
			if (!(await decide(target, "submit"))) {
				return false;
			}
			if (
				!state.alwaysAllowed.some(
					(entry) => entry.toolName === toolName,
				)
			) {
				commit({
					...state,
					alwaysAllowed: [
						...state.alwaysAllowed,
						{ toolName, label: tool },
					],
				});
			}
			say("session.alwaysAllowed", { tool }, "dim");
			// A parallel call of the same tool need not wait for the next poll,
			// in this run or in any other the session follows.
			for (const control of controls) {
				const { agent } = control;
				const current = progressOf(control);
				if (agent === undefined || current === undefined) {
					continue;
				}
				const allowed = takeAllowed(control, current.pendingActions);
				if (allowed.length > 0) {
					const taken = new Set(allowed.map((each) => each.actionId));
					patch(control, (run) => ({
						pendingActions: run.pendingActions.filter(
							(waiting) => !taken.has(waiting.actionId),
						),
					}));
					approveAllowed(control, agent, allowed);
				}
			}
			return true;
		},

		revoke: (tool) => {
			const name = tool?.trim() ?? "";
			if (name === "") {
				if (state.alwaysAllowed.length === 0) {
					say("session.allowedNone", undefined, "dim");
					return false;
				}
				commit({ ...state, alwaysAllowed: [] });
				say("session.revokedAll", undefined, "dim");
				return true;
			}
			const wanted = name.toLowerCase();
			const removed =
				state.alwaysAllowed.find(
					(entry) => entry.toolName.toLowerCase() === wanted,
				) ??
				state.alwaysAllowed.find(
					(entry) => entry.label.toLowerCase() === wanted,
				);
			if (removed === undefined) {
				say("session.unknownAllowed", { name }, "error");
				return false;
			}
			commit({
				...state,
				alwaysAllowed: state.alwaysAllowed.filter(
					(entry) => entry !== removed,
				),
			});
			say("session.revoked", { tool: removed.label }, "dim");
			return true;
		},

		startEdit: (action) => {
			const found = approvalTarget(action);
			if (found === undefined) {
				return undefined;
			}
			editTarget = found.action.actionId;
			const args = JSON.stringify(found.action.toolArgs ?? {}, null, 2);
			return `:edit ${escapeInvisibleInJson(args)}`;
		},

		edit: async (json) => {
			const found = editedCall();
			if (found === undefined) {
				return false;
			}
			const { action: target, label: tool } = found;
			let parsed: unknown;
			try {
				parsed = JSON.parse(json);
			} catch (error) {
				say(
					"session.editInvalid",
					{ message: describeError(error) },
					"error",
				);
				return false;
			}
			if (
				typeof parsed !== "object" ||
				parsed === null ||
				Array.isArray(parsed)
			) {
				say("session.editNotObject", undefined, "error");
				return false;
			}
			const paramValues = parsed as Record<string, unknown>;
			// The SDK's own test: arguments sent back unchanged are an approval.
			const unchanged =
				JSON.stringify(paramValues) ===
				JSON.stringify(target.toolArgs ?? {});
			if (!(await decide(target, "submit", paramValues))) {
				return false;
			}
			if (editTarget === target.actionId) {
				editTarget = undefined;
			}
			say(
				unchanged ? "session.approved" : "session.approvedEdited",
				{ tool },
				"dim",
			);
			return true;
		},

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
			// Only subagents can be left, and they belong to the room being
			// left. They are no longer followed, and are not stopped either.
			const following = controls.size;
			for (const control of controls) {
				control.agent?.stop();
			}
			controls.clear();
			exportable = undefined;
			editTarget = undefined;
			const hadAllowed = state.alwaysAllowed.length > 0;
			commit({
				...state,
				roomId: undefined,
				entries: [],
				alwaysAllowed: [],
			});
			host.onRoomChange?.(undefined);
			say("session.newRoom", undefined, "dim");
			if (following > 0) {
				say("session.stoppedFollowing", { n: following }, "dim");
			}
			if (hadAllowed) {
				say("session.revokedAll", undefined, "dim");
			}
			return true;
		},

		clear: () => {
			// A run still followed, the prompt's or a subagent's, keeps its entry.
			const followed = new Set(
				[...controls].map((control) => control.entryId),
			);
			commit({
				...state,
				entries: state.entries.filter(
					(entry) => entry.kind === "run" && followed.has(entry.id),
				),
			});
		},

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
			for (const control of controls) {
				control.agent?.stop();
			}
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

/**
 * Every call waiting on the user, in the run in progress first, then in the
 * other entries, oldest first: a subagent can wait long after its parent ended.
 */
export const waitingActions = (
	state: SessionState,
	translate: Translate = translateEnglish,
): WaitingAction[] => {
	const runs = state.entries.filter(
		(entry): entry is RunEntry => entry.kind === "run",
	);
	return [
		...runs.filter((entry) => entry.id === state.activeEntryId),
		...runs.filter((entry) => entry.id !== state.activeEntryId),
	].flatMap((entry) => waitingIn(entry, translate));
};

/** The call the approval keys act on: the first waiting that is not a question. */
export const keyedApproval = (
	state: SessionState,
): PendingAgentAction | undefined =>
	waitingActions(state).find(
		(waiting) => !isRequestUserInputAction(waiting.action),
	)?.action;
