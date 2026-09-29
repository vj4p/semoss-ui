import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	type Line,
	type RunEntry,
	textLine,
	translateEnglish,
} from "@semoss/agent-core";
import { codeResources, I18nBuilder } from "@semoss/i18n";
import type { PendingAgentAction } from "@semoss/sdk/react";
import { Transcript } from "./transcript";

const builder = new I18nBuilder(codeResources, { lockToEnglish: true });

type ToolLine = Extract<Line, { kind: "tool" }>;
type SubagentLine = Extract<Line, { kind: "subagent" }>;

/** A finished call with an argument and two lines of output. */
const tool = (extra: Partial<ToolLine> = {}): ToolLine => ({
	kind: "tool",
	label: "Bash",
	status: "COMPLETED",
	detail: "git status",
	args: [{ key: "command", text: "git status" }],
	output: "On branch dev\nnothing to commit",
	outputLines: 2,
	outputTruncated: false,
	...extra,
});

/** A subagent still going, as its parent reports it. */
const subagent = (extra: Partial<SubagentLine> = {}): SubagentLine => ({
	kind: "subagent",
	label: "reviewer",
	status: "RUNNING",
	...extra,
});

const transcript = (...lines: Line[]) => (
	<Transcript
		entries={[{ kind: "history", id: "h1", lines }]}
		translate={translateEnglish}
	/>
);

/** The transcript's one disclosure, and the summary that opens it. */
const disclosure = () => {
	const details = screen
		.getByTestId("transcript-log")
		.querySelector("details");
	const summary = details?.querySelector("summary");
	if (!details || !summary) {
		throw new Error("no disclosure in the transcript");
	}
	return { details, summary };
};

beforeAll(async () => {
	await builder.ready;
});

afterEach(() => {
	vi.useRealTimers();
});

describe("a tool call's line", () => {
	it("opens on every argument and the output, drawn while it is closed", () => {
		render(
			transcript(
				tool({
					args: [
						{ key: "command", text: "git status" },
						{ key: "cwd", text: "/repo" },
					],
				}),
			),
		);
		const { details, summary } = disclosure();

		expect(summary).toHaveTextContent("Bash");
		expect(summary).toHaveTextContent("2 lines of output");
		// In the page for the browser's find, which opens it, but not shown.
		const output = within(details).getByText("nothing to commit", {
			exact: false,
		});
		expect(output).not.toBeVisible();

		fireEvent.click(summary);

		expect(output).toBeVisible();
		expect(within(details).getByText("Arguments")).toBeVisible();
		expect(
			within(details)
				.getAllByRole("term")
				.map((term) => term.textContent),
		).toEqual(["command", "cwd"]);
		expect(within(details).getByText("Output")).toBeVisible();
	});

	it("keeps a failed call's error in sight, outside what opens", () => {
		render(
			transcript(
				tool({
					status: "FAILED",
					output: undefined,
					outputLines: undefined,
					error: "exit status 1",
				}),
			),
		);
		const { details } = disclosure();
		const error = screen.getByText("exit status 1");

		expect(error).toBeVisible();
		expect(details).not.toContainElement(error);
	});

	it("says so when an opened call had no arguments", () => {
		render(transcript(tool({ args: [] })));
		const { details, summary } = disclosure();

		fireEvent.click(summary);

		expect(within(details).getByText("No arguments")).toBeVisible();
		expect(within(details).queryByText("Arguments")).toBeNull();
	});

	it("draws a call with nothing more to show as a plain row", () => {
		// Still going, and done having printed nothing.
		for (const output of [undefined, ""]) {
			const { unmount } = render(
				transcript(
					tool({
						args: [],
						output,
						outputLines: output === undefined ? undefined : 0,
					}),
				),
			);

			expect(
				screen.getByTestId("transcript-log").querySelector("details"),
			).toBeNull();
			expect(screen.getByText("Bash").closest("p")).not.toBeNull();
			unmount();
		}
	});

	it("stays open while its run goes on", () => {
		const { rerender } = render(
			transcript(
				tool({
					status: "RUNNING",
					output: undefined,
					outputLines: undefined,
				}),
			),
		);
		const { details, summary } = disclosure();
		fireEvent.click(summary);

		rerender(transcript(tool()));

		expect(disclosure().details).toBe(details);
		expect(details.open).toBe(true);
	});

	it("counts a running call's seconds, which a screen reader skips", () => {
		vi.useFakeTimers();
		vi.setSystemTime(10_000);
		render(
			transcript(
				tool({
					status: "RUNNING",
					runningSince: 7_000,
					output: undefined,
					outputLines: undefined,
				}),
			),
		);
		const count = screen.getByText("3s");

		expect(count).toHaveAttribute("aria-hidden", "true");
		expect(count).toHaveAttribute("datetime", "PT3S");

		act(() => {
			vi.advanceTimersByTime(2_000);
		});

		expect(count).toHaveTextContent("5s");
	});
});

describe("a subagent's line", () => {
	it("opens on its steps, open from the start, and closes on its row", () => {
		render(
			transcript(subagent({ children: [textLine("Reading the diff.")] })),
		);
		const { details, summary } = disclosure();
		const step = within(details).getByText("Reading the diff.");

		expect(details.open).toBe(true);
		expect(summary).toHaveTextContent("reviewer");
		expect(summary).not.toContainElement(step);
		expect(step).toBeVisible();

		fireEvent.click(summary);

		expect(details.open).toBe(false);
		expect(step).not.toBeVisible();
		expect(summary).toBeVisible();
	});

	it.each<{ name: string; extra: Partial<SubagentLine>; text: string }>([
		{
			name: "result",
			extra: { status: "COMPLETED", resultPreview: "Looks fine." },
			text: "Looks fine.",
		},
		{
			name: "error",
			extra: { status: "FAILED", error: "Out of budget" },
			text: "Out of budget",
		},
	])("keeps its $name in sight, outside what opens", ({ extra, text }) => {
		render(
			transcript(
				subagent({
					...extra,
					children: [textLine("Reading the diff.")],
				}),
			),
		);
		const { details, summary } = disclosure();
		const end = screen.getByText(text);

		expect(details).not.toContainElement(end);

		fireEvent.click(summary);

		expect(end).toBeVisible();
	});

	it("draws one with no steps to show as a plain row", () => {
		// Not followed, and followed but not heard from yet.
		for (const children of [undefined, []]) {
			const { unmount } = render(
				transcript(
					subagent({
						status: "COMPLETED",
						resultPreview: "Looks fine.",
						children,
					}),
				),
			);

			expect(
				screen.getByTestId("transcript-log").querySelector("details"),
			).toBeNull();
			expect(screen.getByText("reviewer").closest("p")).not.toBeNull();
			expect(screen.getByText("Looks fine.")).toBeVisible();
			unmount();
		}
	});

	it("closes a nested subagent without closing the one around it", () => {
		render(
			transcript(
				subagent({
					label: "planner",
					children: [
						subagent({ children: [textLine("Reading the diff.")] }),
					],
				}),
			),
		);
		const [outer, inner] = screen
			.getByTestId("transcript-log")
			.querySelectorAll("details");
		const summary = inner?.querySelector("summary");
		if (!outer || !inner || !summary) {
			throw new Error("no nested disclosure in the transcript");
		}
		expect(outer).toContainElement(inner);

		fireEvent.click(summary);

		expect(inner.open).toBe(false);
		expect(outer.open).toBe(true);
		expect(summary).toBeVisible();
		expect(screen.getByText("Reading the diff.")).not.toBeVisible();
	});
});

describe("the hint under an approval", () => {
	const waiting = (id: string, actionId: string): RunEntry => {
		const action: PendingAgentAction = {
			actionId,
			runId: `run-${id}`,
			parentMessageId: null,
			toolCallId: null,
			toolName: "Bash",
			toolArgs: {},
			editedArgs: null,
			toolMeta: null,
			hasUi: false,
			uiUrl: null,
			status: "PENDING",
		};
		return {
			kind: "run",
			id,
			prompt: `Prompt ${id}`,
			harness: "semoss",
			modelId: "model-1",
			runId: `run-${id}`,
			status: "INPUT_REQUIRED",
			items: { itemsById: {}, itemOrder: [] },
			droppedEvents: 0,
			pendingActions: [action],
			startedAt: 1,
		};
	};

	it("goes under the call the keys act on alone, whichever entry it is in", () => {
		render(
			<Transcript
				entries={[
					waiting("entry-1", "action-1"),
					waiting("entry-2", "action-2"),
				]}
				translate={translateEnglish}
				keyedActionId="action-2"
			/>,
		);
		const hint = /^With the prompt empty/;

		expect(
			within(screen.getByTestId("lineView-entry-entry-1")).queryByText(
				hint,
			),
		).toBeNull();
		expect(
			within(screen.getByTestId("lineView-entry-entry-2")).getByText(
				hint,
			),
		).toBeVisible();
	});
});
