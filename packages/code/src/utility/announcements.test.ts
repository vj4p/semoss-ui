import { describe, expect, it } from "vitest";
import {
	type Line,
	type RunEntry,
	type SessionEntry,
	type SessionState,
	translateEnglish,
} from "@semoss/agent-core";
import type { PendingAgentAction } from "@semoss/sdk/react";
import { announcementsFor, lineText } from "./announcements";

const COMPLETED = "The run finished.";

const state = (...entries: SessionEntry[]): SessionState => ({
	catalog: { harnesses: [], models: [] },
	entries,
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
});
