import { describe, expect, it } from "vitest";
import {
	type Line,
	type RunEntry,
	type SessionEntry,
	type SessionState,
	type SubagentProgress,
	translateEnglish,
} from "@semoss/agent-core";
import type { AgentRunItem, PendingAgentAction } from "@semoss/sdk/react";
import { announcementsFor, lineText } from "./announcements";

const COMPLETED = "The run finished.";

const state = (...entries: SessionEntry[]): SessionState => ({
	catalog: { harnesses: [], models: [] },
	entries,
	alwaysAllowed: [],
});

const notice = (id: string, ...texts: string[]): SessionEntry => ({
	kind: "notice",
	id,
	lines: texts.map((text): Line => ({ kind: "text", segments: [{ text }] })),
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
	items: { itemsById: {}, itemOrder: [] },
	droppedEvents: 0,
	pendingActions: [],
	startedAt: 1,
	...overrides,
});

/**
 * A run that spawned `reviewer`, which the console follows as `child`.
 */
const withReviewer = (
	child: Partial<SubagentProgress> = {},
	overrides: Partial<RunEntry> = {},
): RunEntry => {
	const item: AgentRunItem = {
		id: "child-1",
		kind: "subagent",
		childRunId: "child-1",
		alias: "reviewer",
		roomId: "room-child-1",
		status: "RUNNING",
	};
	return run({
		items: { itemsById: { [item.id]: item }, itemOrder: [item.id] },
		subagents: {
			"child-1": {
				followed: true,
				runId: "child-1",
				status: "RUNNING",
				items: { itemsById: {}, itemOrder: [] },
				droppedEvents: 0,
				pendingActions: [],
				...child,
			},
		},
		...overrides,
	});
};

/** A call the reviewer is waiting on. */
const childAction = (overrides: Partial<PendingAgentAction> = {}) =>
	action({ actionId: "child-action-1", runId: "child-1", ...overrides });

const announce = (previous: SessionState, next: SessionState): string[] =>
	announcementsFor(previous, next, translateEnglish, COMPLETED);

describe("lineText", () => {
	it.each<{ name: string; line: Line; text: string }>([
		{
			name: "a prompt",
			line: { kind: "prompt", text: "Find the flaky test" },
			text: "Find the flaky test",
		},
		{
			name: "styled text",
			line: {
				kind: "text",
				segments: [
					{ text: "Run failed: " },
					{ text: "boom", emphasis: "error" },
				],
			},
			text: "Run failed: boom",
		},
		{
			name: "reasoning",
			line: {
				kind: "reasoning",
				text: "Checking the logs",
				collapsed: true,
			},
			text: "Checking the logs",
		},
		{
			name: "a tool with its arguments",
			line: {
				kind: "tool",
				label: "Bash",
				status: "RUNNING",
				detail: "git log --oneline",
			},
			text: "Bash git log --oneline",
		},
		{
			name: "a tool without arguments",
			line: { kind: "tool", label: "Bash", status: "COMPLETED" },
			text: "Bash",
		},
		{
			name: "a subagent",
			line: { kind: "subagent", label: "reviewer", status: "RUNNING" },
			text: "reviewer",
		},
		{
			name: "a divider with a label",
			line: { kind: "divider", label: "harness → semoss" },
			text: "harness → semoss",
		},
		{ name: "a bare divider", line: { kind: "divider" }, text: "" },
	])("reads $name without its styling", ({ line, text }) => {
		expect(lineText(line)).toBe(text);
	});
});

describe("announcementsFor", () => {
	it("says nothing when the entries did not change", () => {
		const current = state(notice("notice-1", "Nothing is running."));

		expect(
			announce(current, { ...current, harness: "claude_code" }),
		).toEqual([]);
	});

	it("reads out a new notice, once", () => {
		const first = notice("notice-1", "Harnesses", "semoss (current)");
		const shown = state(first);

		expect(announce(state(), shown)).toEqual([
			"Harnesses\nsemoss (current)",
		]);
		expect(
			announce(
				shown,
				state(first, notice("notice-2", "Nothing is running.")),
			),
		).toEqual(["Nothing is running."]);
	});

	it("does not read out what the user typed, or a reopened room's history", () => {
		expect(
			announce(
				state(),
				state(
					{ kind: "input", id: "input-1", text: ":help" },
					{
						kind: "history",
						id: "history-1",
						lines: [{ kind: "prompt", text: "An earlier prompt" }],
					},
				),
			),
		).toEqual([]);
	});

	it("does not announce a run the user just started", () => {
		expect(
			announce(
				state(),
				state(run({ status: "STARTING", runId: undefined })),
			),
		).toEqual([]);
	});

	it("announces a tool call waiting for approval, and how to decide, once", () => {
		const waiting = state(run({ pendingActions: [action()] }));

		expect(announce(state(run()), waiting)).toEqual([
			translateEnglish("run.awaitingApproval", { tool: "Bash" }),
			translateEnglish("run.approvalHint"),
		]);
		expect(
			announce(
				waiting,
				state(run({ pendingActions: [action()], droppedEvents: 1 })),
			),
		).toEqual([]);
	});

	it("names the keys that decide it, when the console binds them", () => {
		const options = {
			approvalKeys: {
				approve: "A",
				deny: "D",
				edit: "E",
				always: "Shift+A",
			},
		};

		expect(
			announcementsFor(
				state(run()),
				state(run({ pendingActions: [action()] })),
				translateEnglish,
				COMPLETED,
				options,
			),
		).toEqual([
			translateEnglish("run.awaitingApproval", { tool: "Bash" }),
			"With the prompt empty, press A to allow it, D to reject it, E to change its arguments, or Shift+A to always allow it.",
		]);
	});

	it("announces a question without the approval hint", () => {
		expect(
			announce(
				state(run()),
				state(
					run({
						pendingActions: [
							action({ toolName: "request_user_input" }),
						],
					}),
				),
			),
		).toEqual([translateEnglish("run.awaitingAnswer")]);
	});

	it("announces approvals before a question that arrives with them", () => {
		expect(
			announce(
				state(run()),
				state(
					run({
						pendingActions: [
							action({
								actionId: "action-1",
								toolName: "request_user_input",
							}),
							action({ actionId: "action-2", toolName: "Write" }),
						],
					}),
				),
			),
		).toEqual([
			translateEnglish("run.awaitingApproval", { tool: "Write" }),
			translateEnglish("run.approvalHint"),
			translateEnglish("run.awaitingAnswer"),
		]);
	});

	it("announces the server not answering once, not on every retry", () => {
		const failing = state(run({ transportError: "Network Error" }));

		expect(announce(state(run()), failing)).toEqual([
			translateEnglish("run.reconnecting", { message: "Network Error" }),
		]);
		expect(
			announce(failing, state(run({ transportError: "Timeout" }))),
		).toEqual([]);
	});

	it("announces a run completing", () => {
		expect(
			announce(
				state(run()),
				state(run({ status: "COMPLETED", endedAt: 2 })),
			),
		).toEqual([COMPLETED]);
	});

	it.each<{ name: string; end: Partial<RunEntry>; message: string }>([
		{
			name: "failed",
			end: { status: "FAILED", errorMessage: "Out of tokens" },
			message: translateEnglish("run.failed", {
				message: "Out of tokens",
			}),
		},
		{
			name: "failed without a reason",
			end: { status: "FAILED" },
			message: translateEnglish("run.failedUnknown"),
		},
		{
			name: "was cancelled",
			end: { status: "CANCELLED" },
			message: translateEnglish("run.cancelled"),
		},
		{
			name: "was lost",
			end: { status: "LOST" },
			message: translateEnglish("run.lost"),
		},
		{
			name: "could not start",
			end: { status: "FAILED", startError: "No model is available." },
			message: translateEnglish("run.startFailed", {
				message: "No model is available.",
			}),
		},
	])("says how a run ended when it $name", ({ end, message }) => {
		expect(
			announce(state(run()), state(run({ ...end, endedAt: 2 }))),
		).toEqual([message]);
	});

	it("does not announce the end again when an ended run changes", () => {
		const ended = state(run({ status: "CANCELLED", endedAt: 2 }));

		expect(
			announce(
				ended,
				state(
					run({
						status: "CANCELLED",
						endedAt: 2,
						finalText: "Partial",
					}),
				),
			),
		).toEqual([]);
	});

	it("says the hint only with the call the keys act on", () => {
		const first = action({ actionId: "action-1" });
		const waiting = {
			...state(run({ pendingActions: [first] })),
			activeEntryId: "run-entry-1",
		};

		expect(
			announce(waiting, {
				...state(
					run({
						pendingActions: [
							first,
							action({ actionId: "action-2", toolName: "Write" }),
						],
					}),
				),
				activeEntryId: "run-entry-1",
			}),
		).toEqual([
			translateEnglish("run.awaitingApproval", { tool: "Write" }),
		]);
	});

	describe("for a subagent the console follows", () => {
		const PARENT_ENDED = translateEnglish("run.parentEnded");

		it("names its call by its path, once", () => {
			const waiting = state(
				withReviewer({ pendingActions: [childAction()] }),
			);

			expect(announce(state(withReviewer()), waiting)).toEqual([
				translateEnglish("run.awaitingApproval", {
					tool: "reviewer › Bash",
				}),
				translateEnglish("run.approvalHint"),
			]);
			expect(
				announce(
					waiting,
					state(
						withReviewer({
							pendingActions: [childAction()],
							droppedEvents: 1,
						}),
					),
				),
			).toEqual([]);
		});

		it("says once that the parent has ended, however many of its calls wait", () => {
			const ended = { status: "COMPLETED", endedAt: 2 } as const;

			expect(
				announce(
					state(withReviewer({}, ended)),
					state(
						withReviewer(
							{
								pendingActions: [
									childAction(),
									childAction({
										actionId: "child-action-2",
										toolName: "Write",
									}),
								],
							},
							ended,
						),
					),
				),
			).toEqual([
				translateEnglish("run.awaitingApproval", {
					tool: "reviewer › Bash",
				}),
				translateEnglish("run.awaitingApproval", {
					tool: "reviewer › Write",
				}),
				translateEnglish("run.approvalHint"),
				PARENT_ENDED,
			]);
		});

		it("leaves out the hint when the keys act on a call in the run in progress", () => {
			const ended = {
				id: "run-entry-0",
				runId: "run-0",
				status: "COMPLETED",
				endedAt: 2,
			} as const;
			const active = run({ pendingActions: [action()] });
			const before = {
				...state(withReviewer({}, ended), active),
				activeEntryId: active.id,
			};

			expect(
				announce(before, {
					...before,
					entries: [
						withReviewer(
							{ pendingActions: [childAction()] },
							ended,
						),
						active,
					],
				}),
			).toEqual([
				translateEnglish("run.awaitingApproval", {
					tool: "reviewer › Bash",
				}),
				PARENT_ENDED,
			]);
		});

		it("names the subagent that asks, once for each who asks", () => {
			const question = { toolName: "request_user_input" };

			expect(
				announce(
					state(withReviewer()),
					state(
						withReviewer(
							{ pendingActions: [childAction(question)] },
							{
								pendingActions: [
									action({
										actionId: "action-1",
										...question,
									}),
									action({
										actionId: "action-2",
										...question,
									}),
								],
							},
						),
					),
				),
			).toEqual([
				translateEnglish("run.subagentAwaitingAnswer", {
					subagent: "reviewer",
				}),
				translateEnglish("run.awaitingAnswer"),
			]);
		});

		it("names one that asks from under another by its path", () => {
			const linter: AgentRunItem = {
				id: "child-2",
				kind: "subagent",
				childRunId: "child-2",
				alias: "linter",
				roomId: "room-child-2",
				status: "RUNNING",
			};
			const nested = (...pendingActions: PendingAgentAction[]) =>
				withReviewer({
					items: {
						itemsById: { [linter.id]: linter },
						itemOrder: [linter.id],
					},
					subagents: {
						"child-2": {
							followed: true,
							runId: "child-2",
							status: "RUNNING",
							items: { itemsById: {}, itemOrder: [] },
							droppedEvents: 0,
							pendingActions,
						},
					},
				});

			expect(
				announce(
					state(nested()),
					state(
						nested(
							action({
								actionId: "grandchild-action-1",
								runId: "child-2",
								toolName: "request_user_input",
							}),
						),
					),
				),
			).toEqual([
				translateEnglish("run.subagentAwaitingAnswer", {
					subagent: "reviewer › linter",
				}),
			]);
		});

		it("says neither its end nor its connection trouble", () => {
			const running = state(withReviewer());

			expect(
				announce(
					running,
					state(withReviewer({ transportError: "Network Error" })),
				),
			).toEqual([]);
			expect(
				announce(
					running,
					state(
						withReviewer({
							status: "FAILED",
							errorMessage: "Out of budget",
							endedAt: 3,
						}),
					),
				),
			).toEqual([]);
		});
	});
});
