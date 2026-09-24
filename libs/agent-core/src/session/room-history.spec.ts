import { describe, expect, it } from "vitest";
import {
	type RoomHistoryMessage,
	type RoomHistoryPart,
	roomHistoryLines,
} from "./room-history";

const input = (
	messageId: string,
	parentMessageId: string | undefined,
	...parts: RoomHistoryPart[]
): RoomHistoryMessage => ({
	io: "INPUT",
	type: "INPUT_TEXT",
	messageId,
	parentMessageId,
	parts,
});

const output = (
	messageId: string,
	parentMessageId: string | undefined,
	...parts: RoomHistoryPart[]
): RoomHistoryMessage => ({ io: "OUTPUT", messageId, parentMessageId, parts });

const text = (value: string): RoomHistoryPart => ({
	type: "TEXT",
	text: value,
});

const call = (
	id: string,
	extra: Partial<
		Extract<RoomHistoryPart, { type: "TOOL_CALL" }>["toolCall"]
	> = {},
): RoomHistoryPart => ({
	type: "TOOL_CALL",
	toolCall: {
		id,
		name: "a1f3c9e2_Bash",
		arguments: { command: "ls" },
		...extra,
	},
});

const result = (
	toolCallId: string,
	toolStatus?: string,
	value = "one\ntwo",
): RoomHistoryPart => ({
	type: "TOOL_RESULT",
	toolResult: { toolCallId, toolStatus, output: value },
});

/** A prompt, a response that called one tool, the tool's result, and the answer. */
const toolTurn = (toolStatus?: string): RoomHistoryMessage[] => [
	input("in-1", undefined, text("list files")),
	output("out-1", "in-1", text("Looking."), call("toolu_1")),
	{
		...input("in-2", "out-1", result("toolu_1", toolStatus)),
		type: "INPUT_TOOL_EXEC",
	},
	output("out-2", "in-2", text("Two files.")),
];

describe("roomHistoryLines", () => {
	it("shows nothing for a new room", () => {
		expect(roomHistoryLines([])).toEqual([]);
	});

	it("reads a tool turn as the live transcript would", () => {
		expect(roomHistoryLines(toolTurn())).toEqual([
			{ kind: "prompt", text: "list files" },
			{ kind: "text", segments: [{ text: "Looking." }] },
			{
				kind: "tool",
				label: "a1f3c9e2_Bash",
				status: "COMPLETED",
				detail: "ls",
				outputLines: 2,
				outputTruncated: false,
			},
			{ kind: "text", segments: [{ text: "Two files." }] },
		]);
	});

	it("reads a tool's status the way the harness does", () => {
		const statusOf = (toolStatus?: string) =>
			roomHistoryLines(toolTurn(toolStatus)).find(
				(line) => line.kind === "tool",
			);

		expect(statusOf("error")).toMatchObject({
			status: "FAILED",
			error: "one\ntwo",
			outputLines: undefined,
		});
		expect(statusOf("cancelled")).toMatchObject({ status: "CANCELLED" });
		// Retired, and never shown as waiting: nothing can answer it now.
		expect(statusOf("paused")).toMatchObject({ status: "CANCELLED" });
		expect(statusOf("success")).toMatchObject({ status: "COMPLETED" });
	});

	it("shows a call with no recorded result as queued", () => {
		const lines = roomHistoryLines([
			input("in-1", undefined, text("go")),
			output("out-1", "in-1", call("toolu_1")),
		]);
		expect(lines.at(-1)).toMatchObject({
			kind: "tool",
			status: "QUEUED",
			outputLines: undefined,
		});
	});

	it("labels a tool by its own name, not the routing alias", () => {
		const labelOf = (
			extra: Partial<
				Extract<RoomHistoryPart, { type: "TOOL_CALL" }>["toolCall"]
			>,
		) =>
			roomHistoryLines([
				output("out-1", undefined, call("toolu_1", extra)),
			])[0];

		expect(
			labelOf({ _meta: { SMSS_ORIGINAL_TOOL_NAME: "WebSearch" } }),
		).toMatchObject({ label: "WebSearch" });
		expect(labelOf({ original_name: "WebSearch" })).toMatchObject({
			label: "WebSearch",
		});
		expect(
			labelOf({
				title: "Search",
				_meta: { SMSS_ORIGINAL_TOOL_NAME: "WebSearch" },
			}),
		).toMatchObject({ label: "Search" });
	});

	it("follows the newest branch after a prompt was edited", () => {
		const lines = roomHistoryLines([
			input("in-1", undefined, text("first")),
			output("out-1", "in-1", text("first answer")),
			input("in-2", "out-1", text("original follow-up")),
			output("out-2", "in-2", text("original answer")),
			// The follow-up, edited: a sibling of in-2, added later.
			input("in-3", "out-1", text("edited follow-up")),
			output("out-3", "in-3", text("edited answer")),
		]);
		expect(lines).toEqual([
			{ kind: "prompt", text: "first" },
			{ kind: "text", segments: [{ text: "first answer" }] },
			{ kind: "prompt", text: "edited follow-up" },
			{ kind: "text", segments: [{ text: "edited answer" }] },
		]);
	});

	it("continues past compaction through the summary's leaf", () => {
		const lines = roomHistoryLines([
			input("in-1", undefined, text("before")),
			output("out-1", "in-1", text("summary of earlier turns")),
			{
				...input("in-2", "compacted-away", text("after")),
				summaryLeafMessageId: "out-1",
			},
		]);
		expect(lines.at(-1)).toEqual({ kind: "prompt", text: "after" });
		expect(lines).toHaveLength(3);
	});

	it("starts over at a message whose parent is not in the room", () => {
		const lines = roomHistoryLines([
			input("in-1", undefined, text("old")),
			input("in-2", "missing", text("new")),
		]);
		expect(lines).toEqual([{ kind: "prompt", text: "new" }]);
	});

	it("hides hidden turns but keeps what their tools did", () => {
		const [first, response, toolExec, answer] = toolTurn("error");
		const lines = roomHistoryLines([
			{ ...first, visible: false },
			response,
			{ ...toolExec, visible: false },
			answer,
		]);
		expect(lines[0]).toEqual({
			kind: "text",
			segments: [{ text: "Looking." }],
		});
		expect(lines[1]).toMatchObject({ kind: "tool", status: "FAILED" });
		expect(lines).toHaveLength(3);
	});

	it("shows a prompt as the user typed it", () => {
		const lines = roomHistoryLines([
			input("in-1", undefined, {
				type: "TEXT",
				text: "expanded with skill instructions",
				uiText: "/review",
			}),
			input("in-2", "in-1", { type: "TEXT", text: "plain", uiText: "" }),
		]);
		expect(lines).toEqual([
			{ kind: "prompt", text: "/review" },
			{ kind: "prompt", text: "plain" },
		]);
	});

	it("names attached files and folds reasoning", () => {
		const lines = roomHistoryLines([
			input("in-1", undefined, text("summarise"), {
				type: "MEDIA",
				mediaInfo: { fileName: "report.pdf" },
			}),
			output("out-1", "in-1", {
				type: "THINKING",
				thinking: "Reading it.",
			}),
		]);
		expect(lines).toEqual([
			{ kind: "prompt", text: "summarise" },
			{
				kind: "text",
				segments: [{ text: "report.pdf", emphasis: "path" }],
			},
			{ kind: "reasoning", text: "Reading it.", collapsed: true },
		]);
	});

	it("maps a persisted subagent, and marks a part it cannot read", () => {
		const lines = roomHistoryLines([
			output(
				"out-1",
				undefined,
				{
					type: "SUBAGENT",
					subagent: {
						id: "run-7",
						status: "COMPLETED",
						alias: "reviewer",
					},
				},
				{ type: "HOLOGRAM" } as unknown as RoomHistoryPart,
			),
		]);
		expect(lines).toEqual([
			{ kind: "subagent", label: "reviewer", status: "COMPLETED" },
			{
				kind: "text",
				segments: [
					{
						text: "This item cannot be shown here (HOLOGRAM).",
						emphasis: "dim",
					},
				],
			},
		]);
	});

	it("stops rather than loop when duplicate ids link the chain back on itself", () => {
		const lines = roomHistoryLines([
			input("a", undefined, text("one")),
			output("b", "a", text("two")),
			input("a", "b", text("three")),
		]);
		expect(lines.map((line) => line.kind)).toEqual(["prompt", "text"]);
	});
});
