/**
 * Split what was typed at the console into a prompt for the agent or a
 * command for the console itself.
 *
 * One input box carries both, so the rule that tells them apart has to be one
 * a person can hold in their head: a leading colon is a command, as in vi and
 * less, and two colons send the text as a prompt that happens to start with
 * one. Nothing else is special. In particular a command must come first — a
 * colon later in the text is prose — and whitespace around the input never
 * changes which of the two it is.
 */

export type ParsedInput =
	/** Nothing but whitespace. */
	| { kind: "empty" }
	/** Text for the agent, trimmed. */
	| { kind: "prompt"; text: string }
	/**
	 * A console command.
	 *
	 * `name` is lowercased, and is empty for a bare `:` — reported by the
	 * dispatcher rather than guessed at. `rest` is everything after the name,
	 * trimmed but with its quotes intact, for commands whose argument is free
	 * text with spaces in it.
	 */
	| { kind: "command"; name: string; args: string[]; rest: string };

/**
 * Split an argument string on whitespace, honouring quotes.
 *
 * Lenient by design, since an input box is no place for a syntax error: an
 * unterminated quote runs to the end of the line instead of failing, and a
 * quote in the middle of a word joins what follows onto that word, as a shell
 * does. There are no backslash escapes, so a Windows path survives as typed.
 * An apostrophe is a quote too, so `don't` reads as `dont` — the price of
 * accepting single quotes, and harmless for names and ids.
 */
export const tokenize = (input: string): string[] => {
	const tokens: string[] = [];
	let current = "";
	let inToken = false;
	let quote: string | undefined;

	for (const char of input) {
		if (quote !== undefined) {
			if (char === quote) {
				quote = undefined;
			} else {
				current += char;
			}
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			inToken = true;
			continue;
		}
		if (/\s/.test(char)) {
			if (inToken) {
				tokens.push(current);
				current = "";
				inToken = false;
			}
			continue;
		}
		current += char;
		inToken = true;
	}

	if (inToken) {
		tokens.push(current);
	}
	return tokens;
};

export const parseInput = (raw: string): ParsedInput => {
	const text = raw.trim();
	if (text === "") {
		return { kind: "empty" };
	}
	if (text.startsWith("::")) {
		return { kind: "prompt", text: text.slice(1) };
	}
	if (!text.startsWith(":")) {
		return { kind: "prompt", text };
	}

	const body = text.slice(1);
	// Sliced by the word as typed, not by the lowercased name: lowercasing
	// can change a string's length ("İ" becomes two code units), which would
	// cut the first character off the arguments.
	const word = /^\S*/.exec(body)?.[0] ?? "";
	const rest = body.slice(word.length).trim();
	return {
		kind: "command",
		name: word.toLowerCase(),
		args: tokenize(rest),
		rest,
	};
};
