/**
 * A session's entries as transcript lines.
 *
 * `toTranscript` draws what the agent did. A run entry also says what the
 * console knows about the run that no item carries: that a tool call is
 * waiting on the user, that a stop was asked for, that the server cannot be
 * reached, and how the run ended.
 *
 * A subagent the console follows is drawn the same way, as its own run, under
 * its line in the parent's: a tree, as deep as the console follows.
 */

import {
	type AgentRunItemsState,
	isRequestUserInputAction,
	type PendingAgentAction,
} from "@semoss/sdk";
import { type Translate, translateEnglish } from "../i18n/messages";
import type { ApprovalKeyLabels } from "../keymap/keymap";
import { type ItemStatus, type Line, textLine } from "../transcript/line";
import {
	lineForItem,
	type SubagentDetail,
	type SubagentItem,
	subagentLabel,
	toolLabel,
	toTranscript,
} from "../transcript/transcript";
import type {
	RunEntry,
	RunProgress,
	RunStatus,
	SessionEntry,
	SubagentRun,
} from "./entries";

/** Between the names in a call's path: the subagents it is under, then the tool. */
export const SUBAGENT_PATH_SEPARATOR = " › ";

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
const recoveredFinalText = (run: RunProgress): string | undefined => {
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
	run: RunProgress & { startError?: string },
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

/** What a host changes about how a run is drawn. */
export interface RunLinesOptions {
	/**
	 * A host passes the keys its prompt binds to the four approval actions, and
	 * the hint under a waiting call then names the keys instead of the commands.
	 */
	approvalKeys?: ApprovalKeyLabels;
	/**
	 * The call the approval keys and commands act on, from `keyedApproval`. The
	 * hint goes under its run's approvals and no other, so that "it" means that
	 * call. Without one, it goes under the entry's own first approval.
	 */
	keyedActionId?: string;
}

/**
 * The hint under a tool call waiting for approval: the keys that decide it,
 * when the host binds them, and the commands otherwise. A host that also says
 * what a run waits on some other way, such as a screen reader announcement,
 * says this with it, so that the two cannot disagree.
 */
export const approvalHint = (
	translate: Translate = translateEnglish,
	options: RunLinesOptions = {},
): string => {
	const keys = options.approvalKeys;
	return keys === undefined
		? translate("run.approvalHint")
		: translate("run.approvalKeys", {
				approve: keys.approve,
				deny: keys.deny,
				edit: keys.edit,
				always: keys.always,
			});
};

/**
 * A tool call waiting on the user, wherever it is in an entry's tree: in the
 * run a prompt started, or in a subagent the console follows.
 */
export interface WaitingAction {
	action: PendingAgentAction;
	/** The entry the call is drawn in. */
	entryId: string;
	/** The subagents the call is under, outermost first, by label. Empty for the prompt's own run. */
	subagents: readonly string[];
	/** The tool's own label, from `actionLabel`. */
	tool: string;
	/** The subagents and the tool, joined by {@link SUBAGENT_PATH_SEPARATOR}. */
	label: string;
	/**
	 * The run that spawned the call's subagent has ended, so it will not use
	 * the subagent's result. Deciding the call still lets the subagent carry on.
	 */
	parentEnded: boolean;
}

/** A run that ended on the server. LOST is not one: the console only stopped hearing. */
const isEnded = (status: RunStatus) =>
	status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";

/** A run's status as an item's, once the console has heard it. */
const heardStatus = (status: RunStatus): ItemStatus | undefined =>
	status === "STARTING" || status === "LOST" ? undefined : status;

const notFollowed = (
	record: Exclude<SubagentRun, { followed: true }>,
	translate: Translate,
): string => {
	switch (record.reason) {
		case "depth":
			return translate("run.subagentTooDeep", { n: record.limit });
		case "limit":
			return translate("run.subagentLimit", { n: record.limit });
		case "failed":
			return translate("run.subagentFailed", { message: record.message });
	}
};

interface DrawContext {
	translate: Translate;
	options: RunLinesOptions;
	/** The call the approval keys act on, whose run's approvals get the hint. */
	keyed: string | undefined;
}

/**
 * The calls waiting in `entry`'s tree, in the order they are drawn: a
 * subagent's before its parent's own, since a subagent is drawn with the
 * parent's items and the parent's waiting calls after them.
 */
export const waitingIn = (
	entry: RunEntry,
	translate: Translate = translateEnglish,
): WaitingAction[] => {
	const waiting: WaitingAction[] = [];
	const walk = (
		run: RunProgress,
		subagents: readonly string[],
		parentEnded: boolean,
	) => {
		const { subagents: records } = run;
		if (records !== undefined) {
			for (const id of run.items.itemOrder) {
				const item = run.items.itemsById[id];
				if (item?.kind !== "subagent") {
					continue;
				}
				const record = records[item.childRunId];
				if (record?.followed) {
					walk(
						record,
						[...subagents, subagentLabel(item, translate)],
						isEnded(run.status),
					);
				}
			}
		}
		for (const action of run.pendingActions) {
			const tool = actionLabel(action, run.items);
			waiting.push({
				action,
				entryId: entry.id,
				subagents,
				tool,
				label: [...subagents, tool].join(SUBAGENT_PATH_SEPARATOR),
				parentEnded,
			});
		}
	};
	walk(entry, [], false);
	return waiting;
};

/** What `parent` knows about the subagent `item` is, for its line. */
const subagentDetail = (
	parent: RunProgress,
	item: SubagentItem,
	context: DrawContext,
): SubagentDetail | undefined => {
	const record = parent.subagents?.[item.childRunId];
	if (record === undefined) {
		return undefined;
	}
	if (!record.followed) {
		return {
			children: [textLine(notFollowed(record, context.translate), "dim")],
		};
	}
	const status = heardStatus(record.status);
	return {
		status,
		// Once the console has heard from the run, its own lines say how it
		// ended: its answer, or the line under it.
		endShown: status !== undefined,
		children: progressLines(record, record.runId, context, {
			parentEnded: isEnded(parent.status),
		}),
	};
};

const progressLines = (
	run: RunProgress & { startError?: string },
	id: string,
	context: DrawContext,
	place: { prompt?: string; parentEnded: boolean },
): Line[] => {
	const { translate } = context;
	const lines = toTranscript(run.items, {
		prompt: place.prompt,
		droppedEvents: run.droppedEvents,
		translate,
		// Once the run has ended nothing in it is running, whatever its last
		// items said, so nothing counts up.
		runningSince: run.endedAt === undefined ? run.runningSince : undefined,
		subagent: (item) => subagentDetail(run, item, context),
	});

	const recovered = recoveredFinalText(run);
	if (recovered !== undefined) {
		lines.push(
			lineForItem(
				{
					id: `${id}:final`,
					kind: "message",
					role: "assistant",
					text: recovered,
				},
				translate,
			),
		);
	}

	// A question from RequestUserInput is answered in its form, not approved,
	// so it gets its own line and no approval hint.
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
	if (approvals.some((action) => action.actionId === context.keyed)) {
		lines.push(textLine(approvalHint(translate, context.options), "dim"));
	}
	if (approvals.length < run.pendingActions.length) {
		lines.push(textLine(translate("run.awaitingAnswer"), "accent"));
	}
	if (place.parentEnded && run.pendingActions.length > 0) {
		lines.push(textLine(translate("run.parentEnded"), "dim"));
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

export const runLines = (
	run: RunEntry,
	translate: Translate = translateEnglish,
	options: RunLinesOptions = {},
): Line[] =>
	progressLines(
		run,
		run.id,
		{
			translate,
			options,
			keyed:
				options.keyedActionId ??
				waitingIn(run, translate).find(
					(waiting) => !isRequestUserInputAction(waiting.action),
				)?.action.actionId,
		},
		{ prompt: run.prompt, parentEnded: false },
	);

/** Any entry as lines, for a host that draws the session as one transcript. */
export const entryLines = (
	entry: SessionEntry,
	translate: Translate = translateEnglish,
	options: RunLinesOptions = {},
): readonly Line[] => {
	switch (entry.kind) {
		case "run":
			return runLines(entry, translate, options);
		case "input":
			return [{ kind: "prompt", text: entry.text }];
		case "notice":
		case "history":
			return entry.lines;
	}
};
