import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type Line, translateEnglish } from "@semoss/agent-core";
import { codeResources, I18nBuilder } from "@semoss/i18n";
import { Transcript } from "./transcript";

const builder = new I18nBuilder(codeResources, { lockToEnglish: true });

type ToolLine = Extract<Line, { kind: "tool" }>;

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
