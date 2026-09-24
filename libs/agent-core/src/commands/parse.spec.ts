import { describe, expect, it } from "vitest";
import { parseInput, tokenize } from "./parse";

describe("parseInput", () => {
	it("treats blank input as empty", () => {
		expect(parseInput("")).toEqual({ kind: "empty" });
		expect(parseInput("  \n\t ")).toEqual({ kind: "empty" });
	});

	it("sends anything without a leading colon to the agent, trimmed", () => {
		expect(parseInput("  fix the build \n")).toEqual({
			kind: "prompt",
			text: "fix the build",
		});
	});

	it("keeps a colon later in the text as prose", () => {
		expect(parseInput("note: the tests are flaky")).toEqual({
			kind: "prompt",
			text: "note: the tests are flaky",
		});
	});

	it("sends a double colon as a prompt that starts with one colon", () => {
		expect(parseInput("::root { color: red }")).toEqual({
			kind: "prompt",
			text: ":root { color: red }",
		});
	});

	it("reads a leading colon as a command, lowercasing the name", () => {
		expect(parseInput(":Harness claude_code")).toEqual({
			kind: "command",
			name: "harness",
			args: ["claude_code"],
			rest: "claude_code",
		});
	});

	it("ignores whitespace around a command", () => {
		expect(parseInput("   :help  ")).toEqual({
			kind: "command",
			name: "help",
			args: [],
			rest: "",
		});
	});

	it("keeps the remainder as typed for free-text arguments", () => {
		expect(parseInput(':model  "Claude Sonnet"  4 ')).toMatchObject({
			name: "model",
			args: ["Claude Sonnet", "4"],
			rest: '"Claude Sonnet"  4',
		});
	});

	it("reports a bare colon as a command with no name", () => {
		expect(parseInput(":")).toEqual({
			kind: "command",
			name: "",
			args: [],
			rest: "",
		});
		expect(parseInput(": help")).toMatchObject({
			name: "",
			args: ["help"],
		});
	});

	it("does not cut the arguments short when lowercasing changes length", () => {
		// "İ".toLowerCase() is two code units; slicing by the lowercased name
		// would eat the first character of the arguments.
		expect(parseInput(":İx abc")).toMatchObject({ rest: "abc" });
	});
});

describe("tokenize", () => {
	it("splits on any run of whitespace", () => {
		expect(tokenize(" a  b\tc\n")).toEqual(["a", "b", "c"]);
	});

	it("keeps quoted spaces, with either quote", () => {
		expect(tokenize(`"a b" 'c d'`)).toEqual(["a b", "c d"]);
	});

	it("lets one quote kind carry the other", () => {
		expect(tokenize(`"it's" 'say "hi"'`)).toEqual(["it's", 'say "hi"']);
	});

	it("runs an unterminated quote to the end instead of failing", () => {
		expect(tokenize(`a "b c`)).toEqual(["a", "b c"]);
	});

	it("joins a quoted part onto the word around it, as a shell does", () => {
		expect(tokenize(`pre"fix suf"fix`)).toEqual(["prefix suffix"]);
	});

	it("keeps an empty quoted argument", () => {
		expect(tokenize(`a "" b`)).toEqual(["a", "", "b"]);
	});

	it("leaves backslashes alone", () => {
		expect(tokenize(String.raw`C:\temp\out.json`)).toEqual([
			String.raw`C:\temp\out.json`,
		]);
	});
});
