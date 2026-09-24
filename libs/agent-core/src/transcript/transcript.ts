/**
 * Project an agent run's accumulated items onto a terminal transcript.
 *
 * <h4>Why this is a projection and not a second state machine</h4>
 *
 * The original plan said `AgentRunItemEvent -> Line[]`, which would have meant
 * re-implementing the event folding the SDK already does. The SDK's
 * `applyAgentRunItemEvent` is a pure, idempotent, already-tested reducer that
 * turns events into `AgentRunItemsState` and correctly handles the two ways
 * text arrives (incremental deltas, or all at once on item.started). It is
 * deliberately not public, and does not need to be: `AgentStore.watch` hands
 * the accumulated state to `onEvent`, and `subscription.getItems()` returns it
 * on demand. So the composition is:
 *
 *   events --(SDK's applyAgentRunItemEvent)--> AgentRunItemsState --(here)--> Line[]
 *
 * and this file holds only the presentation projection: pure, synchronous, no
 * accumulation of its own. That shrinks what Phase 1 has to extract, and means
 * a bug in event folding has exactly one place to be.
 */

import type { AgentRunItem, AgentRunItemsState } from "@semoss/sdk";
import { type Translate, translateEnglish } from "../i18n/messages";
import type { ItemStatus, Line } from "./line";

/** The backend's marker when a tool result hit MAX_LIVE_TOOL_RESULT_CHARS (12,000). */
const TRUNCATION_MARKER = "... [truncated for live stream]";

/**
 * Argument keys worth showing beside a tool name, best first.
 *
 * A terminal line has room for the tool and roughly one fact about the call.
 * These are the keys that actually carry the intent across the tools SEMOSS
 * harnesses expose - a shell command, a target file, a query - so `⏵ Bash` can
 * read `⏵ Bash  git log --oneline -5` instead of a JSON blob.
 */
const DIGEST_KEYS = [
	"command",
	"pixel",
	"query",
	"file_path",
	"path",
	"filePath",
	"url",
	"pattern",
	"prompt",
] as const;

const MAX_DETAIL_CHARS = 72;

/** Collapse to a single line and clip, so one item never wraps unpredictably. */
const oneLine = (value: string): string => {
	const flat = value.replace(/\s+/g, " ").trim();
	return flat.length > MAX_DETAIL_CHARS
		? `${flat.slice(0, MAX_DETAIL_CHARS - 1)}…`
		: flat;
};

/**
 * @returns the single most informative argument as a display string, or
 * undefined when there is nothing worth a column (an empty arg map, or only
 * values too structural to summarise).
 */
const digestArguments = (args: Record<string, unknown>): string | undefined => {
	for (const key of DIGEST_KEYS) {
		const value = args[key];
		if (typeof value === "string" && value.trim() !== "") {
			return oneLine(value);
		}
	}
	// No well-known key: fall back to the first scalar, named, since an
	// unlabelled value out of context reads as noise.
	for (const [key, value] of Object.entries(args)) {
		if (
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean"
		) {
			return oneLine(`${key}=${value}`);
		}
	}
	return undefined;
};

/** Count rendered lines, not array length — `output` arrives as one string. */
const countLines = (output: string): number =>
	output === "" ? 0 : output.split("\n").length;

/**
 * Label a subagent by the name a human gave it, else its run id.
 *
 * `alias` is set only for named-subagent tools, never for an anonymous spawn,
 * so the fallback is load-bearing rather than defensive. The id is clipped
 * because a full run id is a UUID and eats the line.
 */
const subagentLabel = (item: Extract<AgentRunItem, { kind: "subagent" }>) =>
	item.alias ?? `subagent ${item.childRunId.slice(0, 8)}`;

/**
 * The name to show for a tool call.
 *
 * `name` alone is not it. A room's MCP tools reach the model renamed to
 * `a<engine-id>_<tool>` so two engines' tools cannot collide, and the backend
 * records the tool's own name in `metadata.SMSS_ORIGINAL_TOOL_NAME`. The
 * fallback order is the one the SDK documents on `title`, and the one the
 * harness's `ToolStore.displayName` uses.
 */
export const toolLabel = (item: Extract<AgentRunItem, { kind: "tool" }>) => {
	const original = item.metadata?.SMSS_ORIGINAL_TOOL_NAME;
	return (
		item.title ||
		(typeof original === "string" && original.trim() !== ""
			? original
			: "") ||
		item.name
	);
};

/**
 * Turn one item into its transcript line.
 *
 * The `never` branch is the point of the exercise: this switch is exhaustive
 * over the real `AgentRunItem` union, so if the SDK's union gains a fifth item
 * kind, this stops compiling instead of silently dropping it from the
 * transcript.
 *
 * At run time the branch can still be reached, by a backend newer than this
 * build. It draws a placeholder rather than throwing, for the reason the
 * missing-entry skip below gives: losing one line beats blanking the
 * transcript.
 */
export const lineForItem = (
	item: AgentRunItem,
	translate: Translate = translateEnglish,
): Line => {
	switch (item.kind) {
		case "message":
			return { kind: "text", segments: [{ text: item.text }] };

		case "reasoning":
			// Collapsed by default: reasoning is long, and a terminal reader
			// wants the conclusion with the option to expand.
			return { kind: "reasoning", text: item.summary, collapsed: true };

		case "tool": {
			const output = item.output;
			return {
				kind: "tool",
				label: toolLabel(item),
				status: item.status satisfies ItemStatus,
				detail: digestArguments(item.arguments),
				durationMs: item.durationMs,
				outputLines:
					output === undefined ? undefined : countLines(output),
				outputTruncated: output?.endsWith(TRUNCATION_MARKER),
				error: item.error,
			};
		}

		case "subagent":
			return {
				kind: "subagent",
				label: subagentLabel(item),
				status: item.status satisfies ItemStatus,
				resultPreview: item.resultPreview,
				error: item.error,
			};

		default: {
			const unknown: never = item;
			return {
				kind: "text",
				segments: [
					{
						text: translate("transcript.unknownItem", {
							kind: String((unknown as { kind?: unknown }).kind),
						}),
						emphasis: "dim",
					},
				],
			};
		}
	}
};

/**
 * Render a run's items in the order they started.
 *
 * @param state    the SDK's accumulated items-state for one run
 * @param options.prompt        the human's input, which the stream never
 *                              carries (see the `prompt` Line variant)
 * @param options.droppedEvents how many events the backend evicted before
 *                              this client drained them. `meta.droppedEvents`
 *                              counts one drain only, so a host must pass the
 *                              total it has accumulated across polls
 * @param options.translate     the host's translation of the lines this
 *                              projection writes itself; English when omitted
 * @return the transcript, append-only and safe to re-render from scratch
 */
export const toTranscript = (
	state: AgentRunItemsState,
	options: {
		prompt?: string;
		droppedEvents?: number;
		translate?: Translate;
	} = {},
): Line[] => {
	const lines: Line[] = [];
	const translate = options.translate ?? translateEnglish;

	if (options.prompt !== undefined) {
		lines.push({ kind: "prompt", text: options.prompt });
	}

	for (const id of state.itemOrder) {
		const item = state.itemsById[id];
		// itemOrder and itemsById are maintained together by the SDK reducer, so
		// a missing entry would be a reducer bug rather than a state a caller
		// can reach. Skip rather than throw: losing one line beats blanking the
		// whole transcript.
		if (item !== undefined) {
			lines.push(lineForItem(item, translate));
		}
	}

	// The backend's per-run event queue is capped at MAX_EVENTS_PER_RUN = 2000
	// and evicts the OLDEST events once full, counting them in droppedEvents.
	// A long run therefore has real holes in its live feed. Saying so is not
	// optional: an unmarked gap reads as the agent having done nothing, and the
	// durable snapshot is the only way to recover what was lost.
	if (options.droppedEvents !== undefined && options.droppedEvents > 0) {
		lines.push({
			kind: "divider",
			label: translate("transcript.droppedEvents", {
				n: options.droppedEvents,
			}),
			emphasis: "error",
		});
	}

	return lines;
};
