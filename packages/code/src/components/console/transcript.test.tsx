import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { type Line, translateEnglish } from "@semoss/agent-core";
import { codeResources, I18nBuilder } from "@semoss/i18n";
import { Transcript } from "./transcript";

const builder = new I18nBuilder(codeResources, { lockToEnglish: true });

const bash: Line = {
	kind: "tool",
	label: "Bash",
	status: "COMPLETED",
	args: [{ key: "command", text: "git status" }],
	output: "On branch dev",
	outputLines: 1,
	outputTruncated: false,
};

const answer = (text: string): Line => ({ kind: "text", segments: [{ text }] });

/** One entry, so that a new line is an update and never a new entry. */
const transcript = (...lines: Line[]) => (
	<Transcript
		entries={[{ kind: "history", id: "h1", lines }]}
		translate={translateEnglish}
	/>
);

/** The heights jsdom does not lay out. */
const measure = (log: HTMLElement, scrollHeight: number) => {
	Object.defineProperty(log, "clientHeight", {
		configurable: true,
		value: 100,
	});
	Object.defineProperty(log, "scrollHeight", {
		configurable: true,
		value: scrollHeight,
	});
};

/** Opens or closes the disclosure, once the log has heard it did. */
const toggle = async (details: HTMLDetailsElement) => {
	const toggled = new Promise((resolve) =>
		details.addEventListener("toggle", resolve, { once: true }),
	);
	fireEvent.click(details.querySelector("summary") as HTMLElement);
	await toggled;
};

beforeAll(async () => {
	await builder.ready;
});

describe("Transcript", () => {
	it("stays put once a call opened past its end, and follows once it is closed", async () => {
		const { rerender } = render(transcript(bash));
		const log = screen.getByTestId("transcript-log");
		const details = log.querySelector("details") as HTMLDetailsElement;
		log.scrollTop = 0;

		// Opening the call at the end runs the log 300px past it.
		measure(log, 400);
		await toggle(details);
		rerender(transcript(bash, answer("Clean.")));

		expect(log.scrollTop).toBe(0);

		// Closing it brings the end back into view, and the log follows it.
		measure(log, 100);
		await toggle(details);
		rerender(transcript(bash, answer("Clean."), answer("Done.")));

		expect(log.scrollTop).toBe(100);
	});
});
