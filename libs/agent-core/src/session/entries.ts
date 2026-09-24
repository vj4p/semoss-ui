/**
 * What a console session shows, as immutable data.
 *
 * The session keeps entries rather than lines because a run keeps changing
 * after it is appended and nothing else does. A host turns each entry into
 * lines with `entryLines`, and can cache the result per entry: an update
 * replaces only the entries it changed, so every other entry keeps its
 * identity.
 */

import type {
	AgentRunItemsState,
	AgentRunStatusValue,
	PendingAgentAction,
} from "@semoss/sdk";
import type { Line } from "../transcript/line";

/**
 * A run's status as the console knows it: the backend's, and two of its own.
 *
 * STARTING covers the time before the backend has a run to report on, while
 * the room and then the run are created. LOST means the console stopped
 * hearing about the run before it ended. That is not the same as the run
 * failing, and the difference matters: a lost run may still be working on the
 * server.
 */
export type RunStatus = "STARTING" | AgentRunStatusValue | "LOST";

export interface RunEntry {
	kind: "run";
	id: string;
	prompt: string;
	/** What the run was started with. A later switch changes the next run, not this one. */
	harness: string;
	modelId: string;
	/** Set once the backend accepts the run. */
	runId?: string;
	status: RunStatus;
	items: AgentRunItemsState;
	/** Events the backend evicted before the console polled them, summed over every poll. */
	droppedEvents: number;
	/** Tool calls waiting on a decision, less the ones this console has already decided. */
	pendingActions: readonly PendingAgentAction[];
	finalText?: string;
	errorMessage?: string;
	/** Why the run never started: the room or the run could not be created. */
	startError?: string;
	/** The last poll's failure, cleared by the next poll that succeeds. */
	transportError?: string;
	stopRequested?: boolean;
	startedAt: number;
	/** Set when the console stops following the run, whatever the reason. */
	endedAt?: number;
}

/** A command, echoed as it was typed. */
export interface InputEntry {
	kind: "input";
	id: string;
	text: string;
}

/** Lines the console wrote itself: a command's output, or why something did not happen. */
export interface NoticeEntry {
	kind: "notice";
	id: string;
	lines: readonly Line[];
}

/**
 * A reopened room's earlier turns.
 *
 * Not a notice, because a host announces notices to a screen reader, and
 * reading out a room's whole history when it opens would bury everything
 * after it.
 */
export interface HistoryEntry {
	kind: "history";
	id: string;
	lines: readonly Line[];
}

export type SessionEntry = RunEntry | InputEntry | NoticeEntry | HistoryEntry;
