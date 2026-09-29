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

/**
 * What the console knows about one run it follows: the run a prompt started,
 * or a subagent of it.
 */
export interface RunProgress {
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
	/** The last poll's failure, cleared by the next poll that succeeds. */
	transportError?: string;
	stopRequested?: boolean;
	/**
	 * By item id, when the console first drew each tool running, in epoch
	 * milliseconds. Items carry no start time, and a host counts a running
	 * tool's time from this.
	 */
	runningSince?: Readonly<Record<string, number>>;
	/** Set when the console stops following the run, whatever the reason. */
	endedAt?: number;
	/**
	 * By child run id, what the console did about each subagent the run
	 * spawned: followed it, or why not. A subagent the console never decided
	 * about, because the host cannot follow runs, has no record.
	 */
	subagents?: Readonly<Record<string, SubagentRun>>;
}

export interface RunEntry extends RunProgress {
	kind: "run";
	id: string;
	prompt: string;
	/** What the run was started with. A later switch changes the next run, not this one. */
	harness: string;
	modelId: string;
	/** Why the run never started: the room or the run could not be created. */
	startError?: string;
	startedAt: number;
}

/**
 * A subagent the console follows through its own run.
 *
 * Its status is STARTING until the first poll of that run lands, and a host
 * reads that as not heard from yet: the parent's item says more meanwhile.
 */
export interface SubagentProgress extends RunProgress {
	followed: true;
	runId: string;
}

/**
 * What the console did about one subagent. It follows each one until it ends,
 * not until its parent does, which is usually first: a parent that completes
 * leaves its subagents running on the server. One it does not follow is drawn
 * as its parent reports it, with a line that says why its steps are missing.
 */
export type SubagentRun =
	| SubagentProgress
	/** Past the depth the console follows to, or past how many it follows at once. */
	| { followed: false; reason: "depth" | "limit"; limit: number }
	/** The host could not make a store for the run. */
	| { followed: false; reason: "failed"; message: string };

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
