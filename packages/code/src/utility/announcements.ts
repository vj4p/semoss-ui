import {
	approvalHint,
	keyedApproval,
	type Line,
	type RunEntry,
	type RunLinesOptions,
	runEndLine,
	type SessionState,
	SUBAGENT_PATH_SEPARATOR,
	type Translate,
	type WaitingAction,
	waitingIn,
} from "@semoss/agent-core";
import { isRequestUserInputAction } from "@semoss/sdk/react";

/**
 * A line's words, without its styling, for a screen reader.
 *
 * @name lineText
 * @param line - The line to read.
 * @return Its text.
 */
export const lineText = (line: Line): string => {
	switch (line.kind) {
		case "prompt":
		case "reasoning":
			return line.text;
		case "text":
			return line.segments.map((segment) => segment.text).join("");
		case "tool":
			return line.detail ? `${line.label} ${line.detail}` : line.label;
		case "subagent":
			return line.label;
		case "divider":
			return line.label ?? "";
	}
};

/**
 * What a call waiting on the user is, in words: the tool waiting for
 * approval, by its path when a subagent's, or who is asking a question.
 *
 * @name waitingText
 * @param waiting - The call, from waitingIn or waitingActions.
 * @param translate - Translate for agent-core's messages.
 * @return The words, which the pending actions show and the announcer says.
 */
export const waitingText = (
	waiting: WaitingAction,
	translate: Translate,
): string => {
	if (!isRequestUserInputAction(waiting.action)) {
		return translate("run.awaitingApproval", { tool: waiting.label });
	}
	if (waiting.subagents.length > 0) {
		return translate("run.subagentAwaitingAnswer", {
			subagent: waiting.subagents.join(SUBAGENT_PATH_SEPARATOR),
		});
	}
	return translate("run.awaitingAnswer");
};

/**
 * What changed about a run that the user has to hear about: a tool call or a
 * question now waiting on them anywhere in its tree, the server no longer
 * answering, and the end. The hint is said only with the call the approval
 * keys act on, as the transcript draws it only under that call's run. A
 * subagent's end, and its connection trouble, are drawn under its line and
 * not said: the user did not start that run, and what it waits on is said as
 * it comes.
 */
const runAnnouncements = (
	previous: RunEntry | undefined,
	run: RunEntry,
	translate: Translate,
	completed: string,
	options: RunLinesOptions,
	keyed: string | undefined,
): string[] => {
	const messages: string[] = [];

	const known = new Set(
		previous === undefined
			? []
			: waitingIn(previous, translate).map(
					(waiting) => waiting.action.actionId,
				),
	);
	const fresh = waitingIn(run, translate).filter(
		(waiting) => !known.has(waiting.action.actionId),
	);
	const approvals = fresh.filter(
		(waiting) => !isRequestUserInputAction(waiting.action),
	);
	for (const waiting of approvals) {
		messages.push(waitingText(waiting, translate));
	}
	if (approvals.some((waiting) => waiting.action.actionId === keyed)) {
		messages.push(approvalHint(translate, options));
	}
	// Once for each who asks, as the transcript says it once for each run.
	const questions = new Set(
		fresh
			.filter((waiting) => isRequestUserInputAction(waiting.action))
			.map((waiting) => waitingText(waiting, translate)),
	);
	messages.push(...questions);
	if (fresh.some((waiting) => waiting.parentEnded)) {
		messages.push(translate("run.parentEnded"));
	}

	if (run.endedAt === undefined) {
		// Once, when polling starts to fail, not again for each retry.
		if (
			run.transportError !== undefined &&
			previous?.transportError === undefined
		) {
			messages.push(
				translate("run.reconnecting", { message: run.transportError }),
			);
		}
		return messages;
	}

	if (previous?.endedAt === undefined) {
		const end = runEndLine(run, translate);
		if (end !== undefined) {
			messages.push(lineText(end));
		} else if (run.status === "COMPLETED") {
			messages.push(completed);
		}
	}
	return messages;
};

/**
 * What a screen reader should say about one change to the session.
 *
 * The transcript itself is not a live region: a run streams text and tool
 * output far faster than anyone can listen to it. What is announced is what
 * the user has to act on, or would otherwise not know: the console's own
 * notices, a tool call or question waiting on them, in a run the user
 * started or a subagent the console follows under it, the connection
 * failing, and how a run ended. A run's start is not, because the user
 * started it, nor is its answer, which is read in the transcript. Neither is
 * a reopened room's history.
 *
 * @name announcementsFor
 * @param previous - The state before the change.
 * @param next - The state after it.
 * @param translate - The session's translate.
 * @param completed - What to say when a run completes.
 * @param options - How the transcript draws a run, so that the hint read out
 * for a tool call waiting for approval is the one it shows.
 * @return The messages, in the order to say them.
 */
export const announcementsFor = (
	previous: SessionState,
	next: SessionState,
	translate: Translate,
	completed: string,
	options: RunLinesOptions = {},
): string[] => {
	if (previous.entries === next.entries) {
		return [];
	}
	const keyed = keyedApproval(next)?.actionId;
	const before = new Map(previous.entries.map((entry) => [entry.id, entry]));
	return next.entries.flatMap((entry) => {
		const earlier = before.get(entry.id);
		if (earlier === entry) {
			return [];
		}
		switch (entry.kind) {
			case "notice":
				return earlier === undefined
					? [entry.lines.map(lineText).join("\n")]
					: [];
			case "run":
				return runAnnouncements(
					earlier?.kind === "run" ? earlier : undefined,
					entry,
					translate,
					completed,
					options,
					keyed,
				);
			default:
				return [];
		}
	});
};
