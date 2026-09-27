/**
 * Reveal and escape invisible characters that can change how text displays.
 *
 * Bidirectional controls and zero-width characters can make text display in a
 * different order from its logical order, or hide inside it. What a person
 * approves must display in the order it runs, so these characters are revealed
 * as markers or escaped.
 */

/**
 * The characters that can reorder text or hide in it: bidi controls, zero-width
 * spaces, and the byte-order mark. Deliberately excludes ZWNJ (U+200C) and ZWJ
 * (U+200D), which scripts and emoji need and which cannot reorder text.
 */
const INVISIBLE_CODE_POINTS = [
	0x061c, // ALM - Arabic Letter Mark
	0x200b, // ZWSP - Zero Width Space
	0x200e, // LRM - Left-to-Right Mark
	0x200f, // RLM - Right-to-Left Mark
	0x202a, // LRE - Left-to-Right Embedding
	0x202b, // RLE - Right-to-Left Embedding
	0x202c, // PDF - Pop Directional Formatting
	0x202d, // LRO - Left-to-Right Override
	0x202e, // RLO - Right-to-Left Override
	0x2060, // WJ - Word Joiner
	0x2066, // LRI - Left-to-Right Isolate
	0x2067, // RLI - Right-to-Left Isolate
	0x2068, // FSI - First Strong Isolate
	0x2069, // PDI - Pop Directional Isolate
	0xfeff, // BOM / ZWNBSP - Zero Width No-Break Space
];

const INVISIBLE = new RegExp(
	`[${INVISIBLE_CODE_POINTS.map((cp) => String.fromCodePoint(cp)).join("")}]`,
	"gu",
);

const hex = (char: string): string =>
	(char.codePointAt(0) ?? 0).toString(16).padStart(4, "0");

/**
 * Replace each invisible character with a visible marker showing its code point.
 *
 * Each becomes `⟨U+XXXX⟩` (U+27E8, uppercase hex, four digits), so text
 * displays in the order it runs. Use this for displaying arguments to approve.
 */
export const revealInvisible = (text: string): string =>
	text.replace(
		INVISIBLE,
		(char) =>
			String.fromCodePoint(0x27e8) +
			"U+" +
			hex(char).toUpperCase() +
			String.fromCodePoint(0x27e9),
	);

/**
 * Escape each invisible character as JSON escape text.
 *
 * Each becomes `\uXXXX` (lowercase hex), which is valid JSON and parses back to
 * the same character. Use this when filling the prompt with JSON arguments that
 * may contain these characters, so the user sees the escapes rather than hidden
 * or reordered text.
 *
 * This is valid because `JSON.stringify` emits non-ASCII only inside string
 * literals, where an escape sequence parses back to the same character.
 */
export const escapeInvisibleInJson = (json: string): string =>
	json.replace(
		INVISIBLE,
		(char) => `${String.fromCodePoint(92)}u${hex(char)}`,
	);
