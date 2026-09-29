/**
 * Command and argument completion for the prompt input.
 *
 * Tab completion analyzes what the user has typed and suggests:
 * - Command names after `:`
 * - Command arguments (harness names, model names, tool names)
 *
 * The completion system is context-aware: `:har<Tab>` suggests commands,
 * while `:harness cla<Tab>` suggests harness names.
 */

export interface CompletionItem {
	/** The text to insert when this completion is selected. */
	value: string;
	/** Human-readable label (may differ from value, e.g., model name vs ID). */
	label: string;
	/** Optional description shown in the completion menu. */
	description?: string;
	/** Category or type of completion (e.g., "command", "harness", "model"). */
	kind?: string;
}

export interface CompletionResult {
	/** The completions to show. Empty if no completions available. */
	items: CompletionItem[];
	/** Where the completion replaces text (from index, to index in input). */
	range: { start: number; end: number };
}

export interface CompletionContext {
	/** The full input text. */
	text: string;
	/** Cursor position in the input. */
	position: number;
}

/**
 * Provides completions for a given input context.
 *
 * @param context - The current input text and cursor position
 * @returns Completion suggestions, or undefined if no completions available
 */
export type CompletionProvider = (
	context: CompletionContext,
) => CompletionResult | undefined;

/**
 * Parse the input to determine what kind of completion to provide.
 *
 * Returns the command name and argument position if the cursor is in a command.
 */
export const parseCommandContext = (
	text: string,
	position: number,
): { command?: string; argIndex: number; prefix: string } => {
	// Only complete commands (text starting with :)
	if (!text.startsWith(":")) {
		return { argIndex: 0, prefix: "" };
	}

	// Find what's before the cursor
	const beforeCursor = text.slice(0, position);

	// Split by whitespace to get command and args
	const parts = beforeCursor.split(/\s+/);

	if (parts.length === 0) {
		return { argIndex: 0, prefix: "" };
	}

	// If only one part, we're completing the command name itself
	if (parts.length === 1) {
		return { argIndex: 0, prefix: parts[0].slice(1) }; // Remove leading :
	}

	// Multiple parts - we're completing an argument
	const command = parts[0].slice(1); // Remove leading :
	const argIndex = parts.length - 2; // -2 because first part is command, last is current arg
	const prefix = parts[parts.length - 1];

	return { command, argIndex, prefix };
};

/**
 * Filter completion items by prefix (case-insensitive substring match).
 */
export const filterCompletions = (
	items: CompletionItem[],
	prefix: string,
): CompletionItem[] => {
	if (!prefix) return items;

	const lowerPrefix = prefix.toLowerCase();
	return items.filter(
		(item) =>
			item.value.toLowerCase().includes(lowerPrefix) ||
			item.label.toLowerCase().includes(lowerPrefix),
	);
};

/**
 * Find the range to replace for completion insertion.
 *
 * When completing `:har` to `:harness`, replace from after `:` to cursor.
 * When completing `:harness cla` to `:harness claude_code`, replace the last word.
 */
export const getCompletionRange = (
	text: string,
	position: number,
): { start: number; end: number } => {
	const beforeCursor = text.slice(0, position);

	// Find the start of the current word (after last whitespace or colon)
	let start = beforeCursor.lastIndexOf(" ");
	if (start === -1) {
		start = beforeCursor.lastIndexOf(":");
		if (start !== -1) {
			start++; // After the colon
		}
	} else {
		start++; // After the space
	}

	if (start === -1) start = 0;

	// End is current cursor position
	const end = position;

	return { start, end };
};
