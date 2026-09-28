/**
 * What a run entry says beyond its items: the text the feed missed, the calls
 * waiting on the user, and how the run went.
 */

import { describe, expect, it } from "vitest";
import type { AgentRunItem, PendingAgentAction } from "@semoss/sdk";
import { translateEnglish } from "../i18n/messages";
import type { ApprovalKeyLabels } from "../keymap/keymap";
import type { Line } from "../transcript/line";
import type { RunEntry } from "./entries";
import { actionLabel, approvalHint, entryLines, runLines } from "./run-lines";

const itemsOf = (...items: AgentRunItem[]) => ({
	itemsById: Object.fromEntries(items.map((item) => [item.id, item])),
	itemOrder: items.map((item) => item.id),
});

const message = (id: string, text: string): AgentRunItem => ({
	id,
	kind: "message",
	role: "assistant",
	text,
});

const tool = (
	id: string,
	extra: Partial<Extract<AgentRunItem, { kind: "tool" }>> = {},
): AgentRunItem => ({
	id,
	kind: "tool",
	name: "a1f3c9e2_WebSearch",
	arguments: {},
	status: "INPUT_REQUIRED",
	...extra,
});

const action = (
	overrides: Partial<PendingAgentAction> = {},
): PendingAgentAction => ({
	actionId: "action-1",
	runId: "run-1",
	parentMessageId: null,
	toolCallId: null,
	toolName: "Bash",
	toolArgs: {},
	editedArgs: null,
	toolMeta: null,
	hasUi: false,
	uiUrl: null,
	status: "PENDING",
	...overrides,
});

const run = (overrides: Partial<RunEntry> = {}): RunEntry => ({
	kind: "run",
	id: "run-entry-1",
	prompt: "Find the flaky test",
	harness: "semoss",
	modelId: "model-1",
	runId: "run-1",
	status: "RUNNING",
	items: itemsOf(),
	droppedEvents: 0,
	pendingActions: [],
	startedAt: 1,
	...overrides,
});

/** A line as the words on screen, which is what these tests are about. */
const plain = (line: Line): string => {
	switch (line.kind) {
		case "prompt":
		case "reasoning":
			return line.text;
		case "text":
			return line.segments.map((segment) => segment.text).join("");
		case "divider":
			return line.label ?? "";
		case "tool":
		case "subagent":
			return line.label;
	}
};

const texts = (entry: RunEntry) => runLines(entry).map(plain);

/** The emphasis of the one line reading `text`. */
const emphasisOf = (entry: RunEntry, text: string) => {
	const line = runLines(entry).find((candidate) => plain(candidate) === text);
	return line?.kind === "text" ? line.segments[0]?.emphasis : undefined;
};

const KEYS: ApprovalKeyLabels = {
	approve: "A",
	deny: "D",
	edit: "E",
	always: "Shift+A",
};

describe("runLines", () => {
	it("draws the prompt, then the run's items", () => {
		expect(
			texts(run({ items: itemsOf(message("m1", "Looking into it.")) })),
		).toEqual(["Find the flaky test", "Looking into it."]);
	});

	it("carries the dropped-events divider through", () => {
		expect(texts(run({ droppedEvents: 4 })).at(-1)).toBe(
			"Earlier events were dropped from the live feed (4).",
		);
	});

	describe("final text", () => {
		it("is added when the feed never showed it", () => {
			// The events that carried it were dropped, or never drained.
			expect(
				texts(
					run({
						status: "COMPLETED",
						finalText: "All done.",
						endedAt: 2,
					}),
				),
			).toEqual(["Find the flaky test", "All done."]);
		});

		it("is not repeated when the feed already showed it", () => {
			expect(
				texts(
					run({
						status: "COMPLETED",
						items: itemsOf(message("m1", "All done.")),
						finalText: "All done.",
						endedAt: 2,
					}),
				),
			).toEqual(["Find the flaky test", "All done."]);
		});

		it("matches across the whitespace the backend joins blocks with", () => {
			const lines = texts(
				run({
					status: "COMPLETED",
					items: itemsOf(
						message("m1", "Part one."),
						tool("t1", { status: "COMPLETED" }),
						message("m2", "Part two."),
					),
					finalText: "Part one.\n\nPart two.",
					endedAt: 2,
				}),
			);
			expect(lines).toHaveLength(4);
			expect(lines.filter((text) => text.includes("Part"))).toEqual([
				"Part one.",
				"Part two.",
			]);
		});

		it("matches when the backend kept only the last block", () => {
			expect(
				texts(
					run({
						status: "COMPLETED",
						items: itemsOf(
							message("m1", "Part one."),
							message("m2", "Part two."),
						),
						finalText: "Part two.",
						endedAt: 2,
					}),
				),
			).toHaveLength(3);
		});

		it("is added when the feed showed only part of it", () => {
			expect(
				texts(
					run({
						status: "COMPLETED",
						items: itemsOf(message("m1", "Part one.")),
						finalText: "Part one. Part two.",
						endedAt: 2,
					}),
				).at(-1),
			).toBe("Part one. Part two.");
		});

		it("waits for the run to end, so a draining run does not say it twice", () => {
			expect(
				texts(run({ status: "COMPLETED", finalText: "All done." })),
			).toEqual(["Find the flaky test"]);
		});

		it("ignores a final text that is only whitespace", () => {
			expect(
				texts(
					run({ status: "COMPLETED", finalText: " \n ", endedAt: 2 }),
				),
			).toEqual(["Find the flaky test"]);
		});
	});

	describe("waiting on the user", () => {
		it("names each call waiting for approval, then says how to decide", () => {
			const entry = run({
				status: "INPUT_REQUIRED",
				pendingActions: [
					action({ actionId: "a1", toolName: "Bash" }),
					action({ actionId: "a2", toolName: "Write" }),
				],
			});
			expect(texts(entry).slice(1)).toEqual([
				"Bash is waiting for approval.",
				"Write is waiting for approval.",
				"Type :approve to allow it, or :deny to reject it.",
			]);
			expect(emphasisOf(entry, "Bash is waiting for approval.")).toBe(
				"accent",
			);
			expect(
				emphasisOf(
					entry,
					"Type :approve to allow it, or :deny to reject it.",
				),
			).toBe("dim");
		});

		it("asks for an answer, not an approval, when the agent asked a question", () => {
			const entry = run({
				status: "INPUT_REQUIRED",
				pendingActions: [action({ toolName: "RequestUserInput" })],
			});
			expect(texts(entry).slice(1)).toEqual([
				"The agent is asking for your input.",
			]);
		});

		it("recognises a question behind a room's tool alias", () => {
			const entry = run({
				status: "INPUT_REQUIRED",
				pendingActions: [
					action({
						toolName: "a1f3c9e2_RequestUserInput",
						toolMeta: {
							SMSS_ORIGINAL_TOOL_NAME: "RequestUserInput",
						},
					}),
				],
			});
			expect(texts(entry).slice(1)).toEqual([
				"The agent is asking for your input.",
			]);
		});

		it("says both when a question and an approval wait together", () => {
			const entry = run({
				status: "INPUT_REQUIRED",
				pendingActions: [
					action({ actionId: "a1", toolName: "RequestUserInput" }),
					action({ actionId: "a2", toolName: "Bash" }),
				],
			});
			expect(texts(entry).slice(1)).toEqual([
				"Bash is waiting for approval.",
				"Type :approve to allow it, or :deny to reject it.",
				"The agent is asking for your input.",
			]);
		});

		it("names the keys instead of the commands when the host binds them", () => {
			const entry = run({
				status: "INPUT_REQUIRED",
				pendingActions: [action({ toolName: "Bash" })],
			});
			const lines = runLines(entry, translateEnglish, {
				approvalKeys: KEYS,
			});
			expect(lines.slice(1).map(plain)).toEqual([
				"Bash is waiting for approval.",
				"With the prompt empty, press A to allow it, D to reject it, E to change its arguments, or Shift+A to always allow it.",
			]);
			expect(lines.at(-1)).toMatchObject({
				segments: [{ emphasis: "dim" }],
			});
		});

		it("gives a question alone no key hint", () => {
			const entry = run({
				status: "INPUT_REQUIRED",
				pendingActions: [action({ toolName: "RequestUserInput" })],
			});
			expect(
				runLines(entry, translateEnglish, { approvalKeys: KEYS })
					.slice(1)
					.map(plain),
			).toEqual(["The agent is asking for your input."]);
		});
	});

	describe("while the console follows the run", () => {
		it("says a stop was asked for", () => {
			const entry = run({ stopRequested: true });
			expect(texts(entry).at(-1)).toBe("Stopping…");
			expect(emphasisOf(entry, "Stopping…")).toBe("dim");
		});

		it("says the server cannot be reached", () => {
			const entry = run({ transportError: "Network down" });
			expect(texts(entry).at(-1)).toBe(
				"Cannot reach the server. Retrying… (Network down)",
			);
			expect(
				emphasisOf(
					entry,
					"Cannot reach the server. Retrying… (Network down)",
				),
			).toBe("error");
		});

		it("says nothing about the end before the run has ended", () => {
			// A final status while the last events drain is not the end yet.
			expect(
				texts(run({ status: "FAILED", errorMessage: "boom" })),
			).toEqual(["Find the flaky test"]);
		});

		it("gives a running tool the time the console first drew it running", () => {
			const [, line] = runLines(
				run({
					items: itemsOf(tool("call-1", { status: "RUNNING" })),
					runningSince: { "call-1": 5_000 },
				}),
			);
			expect(line).toMatchObject({ kind: "tool", runningSince: 5_000 });
		});
	});

	describe("once the run has ended", () => {
		const ended = (overrides: Partial<RunEntry>) =>
			texts(run({ endedAt: 2, ...overrides })).slice(1);

		it("says nothing more about a run that completed", () => {
			expect(ended({ status: "COMPLETED" })).toEqual([]);
		});

		it("gives the backend's reason for a failure", () => {
			expect(
				ended({ status: "FAILED", errorMessage: "model is required" }),
			).toEqual(["Run failed: model is required"]);
		});

		it("says when a failure came with no reason", () => {
			expect(ended({ status: "FAILED" })).toEqual([
				"Run failed. The server gave no reason.",
			]);
		});

		it("says the run was cancelled", () => {
			const entry = run({ status: "CANCELLED", endedAt: 2 });
			expect(texts(entry).at(-1)).toBe("Run cancelled.");
			expect(emphasisOf(entry, "Run cancelled.")).toBe("dim");
		});

		it("says a lost run may still be running", () => {
			expect(ended({ status: "LOST" })).toEqual([
				"Lost contact with this run. It may still be running on the server.",
			]);
		});

		it("says why a run never started, whatever its status", () => {
			expect(
				ended({ status: "FAILED", startError: "Room not found" }),
			).toEqual(["Could not start the run: Room not found"]);
		});

		it("drops what was only true while it ran", () => {
			expect(
				ended({
					status: "CANCELLED",
					stopRequested: true,
					transportError: "Network down",
				}),
			).toEqual(["Run cancelled."]);
		});

		it("counts nothing up, whatever the last items said", () => {
			// A stopped run's last snapshot can still show a tool running.
			const [, line] = runLines(
				run({
					status: "CANCELLED",
					endedAt: 2,
					items: itemsOf(tool("call-1", { status: "RUNNING" })),
					runningSince: { "call-1": 5_000 },
				}),
			);
			expect(line).toMatchObject({ kind: "tool", status: "RUNNING" });
			expect(
				line?.kind === "tool" ? line.runningSince : null,
			).toBeUndefined();
		});
	});

	it("asks the host to translate what it writes", () => {
		const lines = runLines(
			run({
				status: "INPUT_REQUIRED",
				pendingActions: [action()],
			}),
			(key, params) => `${key}|${params?.tool ?? ""}`,
		);
		expect(lines.slice(1).map(plain)).toEqual([
			"run.awaitingApproval|Bash",
			"run.approvalHint|",
		]);
	});
});

describe("actionLabel", () => {
	it("prefers the run's own item for the call, which has the resolved title", () => {
		expect(
			actionLabel(
				action({ toolCallId: "t1", toolName: "a1f3c9e2_WebSearch" }),
				itemsOf(tool("t1", { title: "Web search" })),
			),
		).toBe("Web search");
	});

	it("falls back to the tool's own name, not the routing alias", () => {
		expect(
			actionLabel(
				action({
					toolCallId: "not-streamed",
					toolName: "a1f3c9e2_WebSearch",
					toolMeta: { SMSS_ORIGINAL_TOOL_NAME: "WebSearch" },
				}),
				itemsOf(),
			),
		).toBe("WebSearch");
	});

	it("falls back to the name as called, then to the action's id", () => {
		expect(
			actionLabel(
				action({ toolMeta: { SMSS_ORIGINAL_TOOL_NAME: " " } }),
				itemsOf(),
			),
		).toBe("Bash");
		expect(actionLabel(action({ toolName: null }), itemsOf())).toBe(
			"action-1",
		);
	});

	it("ignores an item with the call's id that is not a tool", () => {
		expect(
			actionLabel(
				action({ toolCallId: "m1", toolName: "Bash" }),
				itemsOf(message("m1", "hello")),
			),
		).toBe("Bash");
	});
});

describe("entryLines", () => {
	it("echoes a command as a prompt line", () => {
		expect(entryLines({ kind: "input", id: "i1", text: ":help" })).toEqual([
			{ kind: "prompt", text: ":help" },
		]);
	});

	it("hands back a notice's and a history's own lines", () => {
		const lines: Line[] = [
			{ kind: "divider", label: "harness → Claude Code" },
		];
		expect(entryLines({ kind: "notice", id: "n1", lines })).toBe(lines);
		expect(entryLines({ kind: "history", id: "h1", lines })).toBe(lines);
	});

	it("draws a run with runLines", () => {
		const entry = run({ status: "CANCELLED", endedAt: 2 });
		expect(entryLines(entry)).toEqual(runLines(entry));
	});

	it("passes the host's options through to runLines", () => {
		const entry = run({
			status: "INPUT_REQUIRED",
			pendingActions: [action()],
		});
		const options = { approvalKeys: KEYS };
		const lines = entryLines(entry, translateEnglish, options);
		expect(lines).toEqual(runLines(entry, translateEnglish, options));
		expect(lines.map(plain)).toContain(
			"With the prompt empty, press A to allow it, D to reject it, E to change its arguments, or Shift+A to always allow it.",
		);
	});
});

describe("approvalHint", () => {
	it("names the commands when the host binds no keys", () => {
		expect(approvalHint()).toBe(
			"Type :approve to allow it, or :deny to reject it.",
		);
	});

	it("names each key the host binds, as the hint under a waiting call does", () => {
		const options = { approvalKeys: KEYS };
		expect(approvalHint(translateEnglish, options)).toBe(
			"With the prompt empty, press A to allow it, D to reject it, E to change its arguments, or Shift+A to always allow it.",
		);
		expect(
			runLines(
				run({ status: "INPUT_REQUIRED", pendingActions: [action()] }),
				translateEnglish,
				options,
			)
				.map(plain)
				.at(-1),
		).toBe(approvalHint(translateEnglish, options));
	});
});
