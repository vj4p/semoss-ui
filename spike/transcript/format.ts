/**
 * Render a transcript to a terminal.
 *
 * This is the CLI host's whole presentation layer, and it exists in the spike
 * to prove the claim the architecture rests on: that `Line[]` is renderable
 * twice from one projection. If this file needs a field the browser host would
 * not want, or vice versa, then `Line` is leaking presentation and the CLI
 * really would be a rewrite.
 *
 * It is also the honest preview. A screenshot of a monospace React component
 * would only prove CSS; plain ANSI on a real terminal is the thing itself.
 */

import { type Emphasis, type Line, STATUS_GLYPH } from "./line";

/** The browser host maps Emphasis to Tailwind tokens; here it is SGR codes. */
const SGR: Record<Emphasis, string> = {
	dim: "2",
	bold: "1",
	error: "31",
	accent: "36",
	path: "35",
	code: "33",
};

const paint = (
	text: string,
	emphasis: Emphasis | undefined,
	colour: boolean,
) =>
	emphasis === undefined || !colour
		? text
		: `\x1b[${SGR[emphasis]}m${text}\x1b[0m`;

const duration = (ms: number | undefined): string =>
	ms === undefined
		? ""
		: ms < 1000
			? `${ms}ms`
			: `${(ms / 1000).toFixed(1)}s`;

/**
 * Right-align the status column the way a build tool does, so a reader scans
 * one column for state instead of reading every line.
 */
const WIDTH = 74;

/**
 * Every SGR sequence this module can emit.
 *
 * Declared once, and the single place the control-character rule is suppressed.
 * Both stripping and width measurement go through it, so they can never disagree
 * about what counts as invisible.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: ESC is what an SGR sequence is; matching it is the purpose
const ANSI_SGR = /\x1b\[[0-9;]*m/g;

/** Drop all colour, leaving the text a plain terminal or a log file would show. */
export const stripAnsi = (text: string): string => text.replace(ANSI_SGR, "");

/**
 * The column count a string occupies once the terminal has consumed its escape
 * sequences.
 *
 * Alignment MUST be computed on this and never on `String.length`. An SGR
 * sequence is 4-5 invisible characters, so padding by raw length shortens every
 * coloured row by exactly as much colour as it carries - which makes the status
 * column wander, and makes the coloured and plain renders disagree. The spike's
 * strip-and-compare assertion exists to catch precisely this.
 */
const visibleWidth = (text: string): number => stripAnsi(text).length;

const statusColumn = (
	left: string,
	right: string,
	glyph: string,
	colour: boolean,
	emphasis: Emphasis | undefined,
): string => {
	const tail = right === "" ? glyph : `${right}  ${glyph}`;
	const pad = Math.max(1, WIDTH - visibleWidth(left) - visibleWidth(tail));
	return `${left}${" ".repeat(pad)}${paint(tail, emphasis, colour)}`;
};

const emphasisForStatus = (status: keyof typeof STATUS_GLYPH): Emphasis => {
	switch (status) {
		case "COMPLETED":
			return "accent";
		case "FAILED":
			return "error";
		case "INPUT_REQUIRED":
			return "bold";
		case "REJECTED":
		case "CANCELLED":
			return "error";
		default:
			return "dim";
	}
};

/**
 * @param lines  the transcript
 * @param colour false to emit plain text — for a pipe, a log, or a test
 * @return one string per rendered row, ready to join with newlines
 */
export const formatTranscript = (
	lines: Line[],
	{ colour = true }: { colour?: boolean } = {},
): string[] => {
	const out: string[] = [];

	for (const line of lines) {
		switch (line.kind) {
			case "prompt":
				out.push(`${paint("❯", "accent", colour)} ${line.text}`);
				break;

			case "text":
				// Model prose is the one thing rendered verbatim: it is already
				// authored for a reader, and re-wrapping it would fight the
				// model's own formatting.
				for (const raw of line.segments
					.map((s) => paint(s.text, s.emphasis, colour))
					.join("")
					.split("\n")) {
					out.push(raw);
				}
				break;

			case "reasoning": {
				const first = line.text.split("\n")[0] ?? "";
				const body = line.collapsed
					? `${first.slice(0, 66)}${line.text.length > 66 ? "…" : ""}`
					: line.text;
				out.push(paint(`∴ ${body}`, "dim", colour));
				break;
			}

			case "tool": {
				const detail =
					line.detail === undefined
						? ""
						: `  ${paint(line.detail, "code", colour)}`;
				out.push(
					statusColumn(
						`⏵ ${paint(line.label, "bold", colour)}${detail}`,
						duration(line.durationMs),
						STATUS_GLYPH[line.status],
						colour,
						emphasisForStatus(line.status),
					),
				);
				// The output reference, not the output. A tool is capped at
				// 12,000 chars server-side but that is still ~300 lines, which
				// would bury the transcript — so the line count is the
				// affordance and `:out` opens the pager.
				if (line.outputLines !== undefined && line.outputLines > 0) {
					const trunc = line.outputTruncated ? ", truncated" : "";
					out.push(
						paint(
							`  ↳ ${line.outputLines} lines${trunc}`,
							"dim",
							colour,
						),
					);
				}
				if (line.error !== undefined) {
					out.push(
						paint(
							`  ↳ ${line.error.split("\n")[0]}`,
							"error",
							colour,
						),
					);
				}
				break;
			}

			case "subagent": {
				out.push(
					statusColumn(
						`⑂ ${paint(line.label, "accent", colour)}`,
						"",
						STATUS_GLYPH[line.status],
						colour,
						emphasisForStatus(line.status),
					),
				);
				if (line.resultPreview !== undefined) {
					out.push(
						paint(
							`  ↳ ${line.resultPreview.split("\n")[0]}`,
							"dim",
							colour,
						),
					);
				}
				if (line.error !== undefined) {
					out.push(
						paint(
							`  ↳ ${line.error.split("\n")[0]}`,
							"error",
							colour,
						),
					);
				}
				break;
			}

			case "divider": {
				const label = line.label === undefined ? "" : ` ${line.label} `;
				const rule = "─".repeat(
					Math.max(4, (WIDTH - label.length) / 2),
				);
				out.push(
					paint(
						`${rule}${label}${rule}`,
						line.emphasis ?? "dim",
						colour,
					),
				);
				break;
			}

			default: {
				const unreachable: never = line;
				throw new Error(
					`unhandled line: ${JSON.stringify(unreachable)}`,
				);
			}
		}
	}

	return out;
};
