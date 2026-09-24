/**
 * A session's entries as transcript lines.
 *
 * `toTranscript` draws what the agent did. A run entry also says what the
 * console knows about the run that no item carries: that a tool call is
 * waiting on the user, that a stop was asked for, that the server cannot be
 * reached, and how the run ended.
 */

import {
	type AgentRunItemsState,
	isRequestUserInputAction,
	type PendingAgentAction,
} from "@semoss/sdk";
import { type Translate, translateEnglish } from "../i18n/messages";
import { type Line, textLine } from "../transcript/line";
import { lineForItem, toolLabel, toTranscript } from "../transcript/transcript";
import type { RunEntry, SessionEntry } from "./entries";

/**
 * The name to show for a tool call that is waiting on a decision.
 *
 * The run's own item for the call is the better source, because it carries
 * the title the backend resolved. The action alone has the name as the model
 * called it, which for a room's MCP tool is the routing alias.
 */
export const actionLabel = (
	action: PendingAgentAction,
	items: AgentRunItemsState,
): string => {
	const item =
		action.toolCallId === null
			? undefined
			: items.itemsById[action.toolCallId];
	if (item?.kind === "tool") {
		return toolLabel(item);
	}
	const original = action.toolMeta?.SMSS_ORIGINAL_TOOL_NAME;
	return (
		(typeof original === "string" && original.trim() !== ""
			? original
			: "") ||
		action.toolName ||
		action.actionId
	);
};

const squash = (text: string) => text.replace(/\s+/g, "");

/**
 * The run's final text, when the live feed did not already show it.
 *
 * Usually it did, as message items, and printing it again would say
 * everything twice. It is missing when the events that carried it were
 * dropped, or never drained.
 *
 * Whitespace is ignored because the two are not assembled alike: the backend
 * joins the message blocks into `finalText` with separators of its own, and
 * sometimes keeps only the last block. Either way, if all of it is already on
 * screen, in order, nothing is missing.
 *
 * Only once the run has ended, so a run still draining its last events does
 * not show the text twice for a moment.
 */
const recoveredFinalText = (run: RunEntry): string | undefined => {
	const finalText = run.finalText?.trim();
	if (!finalText || run.endedAt === undefined) {
		return undefined;
	}
	const shown = run.items.itemOrder
		.map((id) => run.items.itemsById[id])
		.map((item) => (item?.kind === "message" ? squash(item.text) : ""))
		.join("");
	return shown.includes(squash(finalText)) ? undefined : finalText;
};

/**
 * The line that says how a run ended, for a run that did not simply complete:
 * it never started, it failed, it was cancelled, or the console lost it.
 * Undefined for a completed run, whose answer already says it, and for one
 * still going.
 */
export const runEndLine = (
	run: RunEntry,
	translate: Translate = translateEnglish,
): Line | undefined => {
	if (run.startError !== undefined) {
		return textLine(
			translate("run.startFailed", { message: run.startError }),
			"error",
		);
	}
	switch (run.status) {
		case "FAILED":
			return textLine(
				run.errorMessage
					? translate("run.failed", { message: run.errorMessage })
					: translate("run.failedUnknown"),
				"error",
			);
		case "CANCELLED":
			return textLine(translate("run.cancelled"), "dim");
		case "LOST":
			return textLine(translate("run.lost"), "error");
		default:
			return undefined;
	}
};

export const runLines = (
	run: RunEntry,
	translate: Translate = translateEnglish,
): Line[] => {
	const lines = toTranscript(run.items, {
		prompt: run.prompt,
		droppedEvents: run.droppedEvents,
		translate,
	});

	const recovered = recoveredFinalText(run);
	if (recovered !== undefined) {
		lines.push(
			lineForItem(
				{
					id: `${run.id}:final`,
					kind: "message",
					role: "assistant",
					text: recovered,
				},
				translate,
			),
		);
	}

	// A question from RequestUserInput is answered in its form, not approved,
	// so it gets its own line and no :approve hint.
	const approvals = run.pendingActions.filter(
		(action) => !isRequestUserInputAction(action),
	);
	for (const action of approvals) {
		lines.push(
			textLine(
				translate("run.awaitingApproval", {
					tool: actionLabel(action, run.items),
				}),
				"accent",
			),
		);
	}
	if (approvals.length > 0) {
		lines.push(textLine(translate("run.approvalHint"), "dim"));
	}
	if (approvals.length < run.pendingActions.length) {
		lines.push(textLine(translate("run.awaitingAnswer"), "accent"));
	}

	if (run.endedAt === undefined) {
		if (run.stopRequested) {
			lines.push(textLine(translate("run.stopping"), "dim"));
		}
		if (run.transportError !== undefined) {
			lines.push(
				textLine(
					translate("run.reconnecting", {
						message: run.transportError,
					}),
					"error",
				),
			);
		}
		return lines;
	}

	const end = runEndLine(run, translate);
	if (end !== undefined) {
		lines.push(end);
	}
	return lines;
};

/** Any entry as lines, for a host that draws the session as one transcript. */
export const entryLines = (
	entry: SessionEntry,
	translate: Translate = translateEnglish,
): readonly Line[] => {
	switch (entry.kind) {
		case "run":
			return runLines(entry, translate);
		case "input":
			return [{ kind: "prompt", text: entry.text }];
		case "notice":
		case "history":
			return entry.lines;
	}
};
