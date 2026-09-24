import {
	actionLabel,
	type Line,
	type RunEntry,
	runEndLine,
	type SessionState,
	type Translate,
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
 * What changed about a run that the user has to hear about: a tool call or a
 * question now waiting on them, the server no longer answering, and the end.
 */
const runAnnouncements = (
	previous: RunEntry | undefined,
	run: RunEntry,
	translate: Translate,
	completed: string,
): string[] => {
	const messages: string[] = [];

	const known = new Set(
		previous?.pendingActions.map((action) => action.actionId),
	);
	const fresh = run.pendingActions.filter(
		(action) => !known.has(action.actionId),
	);
	const approvals = fresh.filter(
		(action) => !isRequestUserInputAction(action),
	);
	for (const action of approvals) {
		messages.push(
			translate("run.awaitingApproval", {
				tool: actionLabel(action, run.items),
			}),
		);
	}
	if (approvals.length > 0) {
		messages.push(translate("run.approvalHint"));
	}
	if (approvals.length < fresh.length) {
		messages.push(translate("run.awaitingAnswer"));
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
 * notices, a tool call or question waiting on them, the connection failing,
 * and how a run ended. A run's start is not, because the user started it, nor
 * is its answer, which is read in the transcript. Neither is a reopened
 * room's history.
 *
 * @name announcementsFor
 * @param previous - The state before the change.
 * @param next - The state after it.
 * @param translate - The session's translate.
 * @param completed - What to say when a run completes.
 * @return The messages, in the order to say them.
 */
export const announcementsFor = (
	previous: SessionState,
	next: SessionState,
	translate: Translate,
	completed: string,
): string[] => {
	if (previous.entries === next.entries) {
		return [];
	}
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
				);
			default:
				return [];
		}
	});
};
