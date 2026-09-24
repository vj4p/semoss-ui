/**
 * Prompt history, walked with ↑ and ↓ the way a shell walks it.
 *
 * The one behaviour that matters is the draft. Pressing ↑ halfway through
 * typing something must not lose it: the text is parked, and walking forward
 * past the newest entry brings it back. Edits made to a recalled entry are
 * not kept — walking away from it discards them, and the entry itself is
 * never rewritten — which is simpler than readline and loses nothing that
 * was ever submitted.
 *
 * Pure and immutable, so a host can keep it in whatever state container it
 * already has.
 */

export interface InputHistory {
	/** Oldest first. */
	readonly entries: readonly string[];
	/** The entry on screen, or undefined while the user is on their own draft. */
	readonly cursor: number | undefined;
	/** What was typed before walking back, restored on walking forward past the newest entry. */
	readonly draft: string;
}

export interface HistoryStep {
	history: InputHistory;
	/** What the input should now show. */
	text: string;
}

export const HISTORY_LIMIT = 100;

export const createInputHistory = (
	entries: readonly string[] = [],
): InputHistory => ({ entries, cursor: undefined, draft: "" });

/**
 * Add a submitted input and return to the draft position.
 *
 * Blank input is not recorded, and neither is an exact repeat of the newest
 * entry, so pressing ↑ after running the same command five times reaches the
 * command before it.
 */
export const recordInput = (
	history: InputHistory,
	text: string,
	limit = HISTORY_LIMIT,
): InputHistory => {
	const entry = text.trim();
	const entries =
		entry === "" || history.entries.at(-1) === entry
			? history.entries
			: [...history.entries, entry].slice(-limit);
	return { entries, cursor: undefined, draft: "" };
};

/**
 * @param current what the input shows now, parked as the draft if this is
 * the first step back
 * @return undefined when there is nothing older, so the host lets the key
 * move the caret instead
 */
export const historyPrev = (
	history: InputHistory,
	current: string,
): HistoryStep | undefined => {
	const { entries, cursor } = history;
	if (entries.length === 0 || cursor === 0) {
		return undefined;
	}
	const next = cursor === undefined ? entries.length - 1 : cursor - 1;
	return {
		history: {
			entries,
			cursor: next,
			draft: cursor === undefined ? current : history.draft,
		},
		text: entries[next],
	};
};

/** @return undefined when already on the draft. */
export const historyNext = (history: InputHistory): HistoryStep | undefined => {
	const { entries, cursor } = history;
	if (cursor === undefined) {
		return undefined;
	}
	if (cursor >= entries.length - 1) {
		return {
			history: { entries, cursor: undefined, draft: "" },
			text: history.draft,
		};
	}
	return {
		history: { ...history, cursor: cursor + 1 },
		text: entries[cursor + 1],
	};
};
