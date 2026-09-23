/**
 * The Line model — the load-bearing abstraction of the SEMOSS Code console.
 *
 * A transcript is DATA, not JSX. The web host maps a Line to DOM and Tailwind
 * tokens; a CLI host maps the same Line to stdout and ANSI codes. Emitting class
 * names or JSX here is what would make the CLI a rewrite rather than a second
 * host, so nothing in this file may reference React, the DOM, or a colour.
 *
 * Revised against the real SDK types and the backend emitter — see NOTES.md for
 * the four places the original design sketch was wrong.
 */

/**
 * Semantic weight, never a colour. A host owns the mapping: `error` is
 * red-500 in the browser and `\x1b[31m` in a terminal, and neither decision
 * belongs here.
 */
export type Emphasis = "dim" | "bold" | "error" | "accent" | "path" | "code";

export interface Segment {
	text: string;
	emphasis?: Emphasis;
}

/**
 * Every status a tool or subagent item can report.
 *
 * Deliberately the UNION of two backend enums that are not the same set:
 * `AgentStreamItems.TOOL_*` has QUEUED and REJECTED, while subagents use
 * `AgentRunStatus` which has SUBMITTED instead and never REJECTED. A single
 * glyph map has to cover all eight or a status renders blank.
 */
export type ItemStatus =
	| "QUEUED"
	| "SUBMITTED"
	| "RUNNING"
	| "INPUT_REQUIRED"
	| "COMPLETED"
	| "FAILED"
	| "REJECTED"
	| "CANCELLED";

export type Line =
	/**
	 * The human's turn. Host-injected, NOT derived from the event stream:
	 * `AgentRunItem` of kind "message" is typed `role: "assistant"` only, so
	 * the user's own prompt never appears as an item. The console must remember
	 * what it submitted (or read `inputMessageId` from the durable snapshot).
	 */
	| { kind: "prompt"; text: string }
	| { kind: "text"; segments: Segment[] }
	/** Reasoning. The source field is `summary`, not `text`. */
	| { kind: "reasoning"; text: string; collapsed: boolean }
	| {
			kind: "tool";
			/** Display name: `title` when the backend resolved one, else `name`. */
			label: string;
			status: ItemStatus;
			/** One-line argument digest, for the `⏵ Bash  git log --oneline` idiom. */
			detail?: string;
			durationMs?: number;
			/** Line count of `output`, for the `↳ 412 lines` affordance. */
			outputLines?: number;
			/** True when the backend hit its 12,000-char live-stream cap. */
			outputTruncated?: boolean;
			/** Present only on FAILED. */
			error?: string;
	  }
	/**
	 * A spawned subagent.
	 *
	 * No `depth` — the original sketch assumed one, but `AgentRunItem` of kind
	 * "subagent" carries only `childRunId`/`roomId`/`alias`. Every subagent in
	 * ONE run's stream is a direct child. Real nesting means recursively
	 * watching each `childRunId`, and the host that does that owns the indent.
	 */
	| {
			kind: "subagent";
			label: string;
			status: ItemStatus;
			/** Set on COMPLETED, capped at MAX_RESULT_PREVIEW_CHARS (2,000). */
			resultPreview?: string;
			/** Set on FAILED. Omitting this rendered a failed subagent as a bare glyph. */
			error?: string;
	  }
	/** A structural marker: harness switch, a gap, end of run. */
	| { kind: "divider"; label?: string; emphasis?: Emphasis };

/**
 * Status glyphs, in the terminal tradition of one column carrying state.
 *
 * QUEUED and SUBMITTED share a glyph because they mean the same thing to a
 * reader — accepted, not started — and differ only in which backend enum
 * produced them.
 */
export const STATUS_GLYPH: Record<ItemStatus, string> = {
	QUEUED: "◌",
	SUBMITTED: "◌",
	RUNNING: "◐",
	INPUT_REQUIRED: "⚠",
	COMPLETED: "✔",
	FAILED: "✘",
	REJECTED: "⊘",
	CANCELLED: "⊗",
};
