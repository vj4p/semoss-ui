/**
 * A run's event stream, shaped exactly as the backend emits it.
 *
 * <h4>Why this is emitter-derived rather than captured from a live run</h4>
 *
 * A single captured run is a weak fixture: it exercises whatever path it
 * happened to take and proves nothing about REJECTED, CANCELLED,
 * INPUT_REQUIRED, subagents, or truncation. This fixture is instead written
 * against `AgentStreamItems` and `AgentRunStreamService` line by line, so it
 * covers every emitted shape, and it is annotated `AgentRunItemEvent[]` so the
 * COMPILER enforces that each entry is a legal event. A hand-waved fixture
 * cannot typecheck against the real union; this one has to.
 *
 * Every detail below traces to the emitter:
 *
 * - item ids follow `AgentStreamItems.messageItemId`:
 *   `runId + ":model:" + ordinal + ":message"`
 * - `patch` carries ONLY `status`. Verified across all four publish sites:
 *   HarnessToolExecutor (RUNNING), SemossAgentHarness (INPUT_REQUIRED),
 *   AgentRunExecutor (subagent status). Nothing else is ever patched.
 * - `output` / `error` / `durationMs` appear ONLY on item.completed, because
 *   `AgentStreamItems.toolItem` does not build them and
 *   `publishToolItemTerminal` adds them just before publishing.
 * - text arrives two ways, and both are represented here: started + deltas +
 *   completed, and started + completed in one shot with the full text
 *   (`completeActiveMessage` when there was no active streaming message).
 * - the truncation suffix is `AgentStreamItems.truncate`'s literal marker.
 */

import type { AgentRunItemEvent } from "../../libs/sdk/src/types";

const RUN = "run-7f3c91";
const T = "2026-09-21T14:22:08.114Z";

/** The five envelope fields every event carries, per AgentRunItemEvent. */
let seq = 0;
const env = (type: AgentRunItemEvent["type"]) => ({
	version: 1 as const,
	eventId: `${RUN}-e${++seq}`,
	sequence: seq,
	runId: RUN,
	timestamp: T,
	type,
});

export const PROMPT =
	"check whether the harness picker is still hardcoded anywhere";

export const FIXTURE: AgentRunItemEvent[] = [
	// ---- reasoning, streamed as deltas -------------------------------------
	{
		...env("item.started"),
		type: "item.started",
		item: {
			id: `${RUN}:model:0:reasoning`,
			kind: "reasoning",
			summary: "",
		},
	},
	{
		...env("item.updated"),
		type: "item.updated",
		itemId: `${RUN}:model:0:reasoning`,
		kind: "reasoning",
		delta: "The picker was hardcoded in two packages. ",
	},
	{
		...env("item.updated"),
		type: "item.updated",
		itemId: `${RUN}:model:0:reasoning`,
		kind: "reasoning",
		delta: "Checking whether either copy survived the change.",
	},
	{
		...env("item.completed"),
		type: "item.completed",
		item: {
			id: `${RUN}:model:0:reasoning`,
			kind: "reasoning",
			summary:
				"The picker was hardcoded in two packages. Checking whether either copy survived the change.",
		},
	},

	// ---- a tool that succeeds: QUEUED -> RUNNING -> COMPLETED -------------
	{
		...env("item.started"),
		type: "item.started",
		item: {
			id: "toolu_01A",
			kind: "tool",
			name: "semoss__BashCommand",
			title: "Bash",
			arguments: { command: "rg -n 'AGENT_HARNESS_TYPES' packages libs" },
			status: "QUEUED",
		},
	},
	{
		...env("item.updated"),
		type: "item.updated",
		itemId: "toolu_01A",
		kind: "tool",
		patch: { status: "RUNNING" },
	},
	{
		...env("item.completed"),
		type: "item.completed",
		item: {
			id: "toolu_01A",
			kind: "tool",
			name: "semoss__BashCommand",
			title: "Bash",
			arguments: { command: "rg -n 'AGENT_HARNESS_TYPES' packages libs" },
			status: "COMPLETED",
			output: [
				"packages/harness/src/stores/message/agent-harness.ts:31:export const AGENT_HARNESS_TYPES = [",
				"packages/harness/src/components/room/room-options-form.tsx:64:  AGENT_HARNESS_TYPES.map(",
				"packages/harness/src/pages/new-room-page.tsx:98:  AGENT_HARNESS_TYPES.map(",
			].join("\n"),
			durationMs: 412,
		},
	},

	// ---- a tool that pauses for a human, then is rejected -----------------
	// INPUT_REQUIRED is patched by SemossAgentHarness.publishAskToolsInputRequired;
	// REJECTED lands via AgentToolDecisionHandler once the human declines.
	{
		...env("item.started"),
		type: "item.started",
		item: {
			id: "toolu_02B",
			kind: "tool",
			name: "semoss__BashCommand",
			title: "Bash",
			arguments: { command: "rm -rf packages/harness/dist" },
			status: "QUEUED",
		},
	},
	{
		...env("item.updated"),
		type: "item.updated",
		itemId: "toolu_02B",
		kind: "tool",
		patch: { status: "INPUT_REQUIRED" },
	},
	{
		...env("item.completed"),
		type: "item.completed",
		item: {
			id: "toolu_02B",
			kind: "tool",
			name: "semoss__BashCommand",
			title: "Bash",
			arguments: { command: "rm -rf packages/harness/dist" },
			status: "REJECTED",
			durationMs: 9_840,
		},
	},

	// ---- a subagent: SUBMITTED -> RUNNING -> COMPLETED -------------------
	// Note SUBMITTED, not QUEUED: subagents report AgentRunStatus, a different
	// enum from the tool statuses above.
	{
		...env("item.started"),
		type: "item.started",
		item: {
			id: "run-b21e44",
			kind: "subagent",
			childRunId: "run-b21e44",
			alias: "reviewer",
			roomId: "room-99c1",
			status: "SUBMITTED",
		},
	},
	{
		...env("item.updated"),
		type: "item.updated",
		itemId: "run-b21e44",
		kind: "subagent",
		patch: { status: "RUNNING" },
	},
	{
		...env("item.completed"),
		type: "item.completed",
		item: {
			id: "run-b21e44",
			kind: "subagent",
			childRunId: "run-b21e44",
			alias: "reviewer",
			roomId: "room-99c1",
			status: "COMPLETED",
			resultPreview:
				"All three call sites now read the backend; no hardcoded list remains.",
		},
	},

	// ---- an anonymous subagent that fails (no alias) ----------------------
	{
		...env("item.completed"),
		type: "item.completed",
		item: {
			id: "run-cc0917fe",
			kind: "subagent",
			childRunId: "run-cc0917fe",
			roomId: "room-99c2",
			status: "FAILED",
			error: "model engine is required",
		},
	},

	// ---- a tool that fails, with truncated output ------------------------
	{
		...env("item.completed"),
		type: "item.completed",
		item: {
			id: "toolu_03C",
			kind: "tool",
			name: "semoss__RunPixel",
			arguments: { pixel: "GetAgentHarnesses();" },
			status: "FAILED",
			error: "Invalid function type SEARXNG_SEARCH",
			output: `${Array.from({ length: 5 }, (_, i) => `frame ${i}`).join("\n")}\n... [truncated for live stream]`,
			durationMs: 1_203,
		},
	},

	// ---- the final message, delivered whole rather than streamed ---------
	// completeActiveMessage emits started AND completed back to back with the
	// full text when no streaming message was active.
	{
		...env("item.started"),
		type: "item.started",
		item: {
			id: `${RUN}:model:1:message`,
			kind: "message",
			role: "assistant",
			text: "The list is gone from all three call sites.\nEach now reads GetAgentHarnesses.",
			messageId: "msg-4410",
		},
	},
	{
		...env("item.completed"),
		type: "item.completed",
		item: {
			id: `${RUN}:model:1:message`,
			kind: "message",
			role: "assistant",
			text: "The list is gone from all three call sites.\nEach now reads GetAgentHarnesses.",
			messageId: "msg-4410",
		},
	},
];
