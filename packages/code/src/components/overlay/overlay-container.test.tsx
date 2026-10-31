import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { OverlayContainer } from "./overlay-container";
import { overlayI18n, renderOverlay } from "./render-overlay";

/** A prompt and an overlay opened from it by a command, as the console does. */
const Host = () => {
	const [open, setOpen] = useState(false);
	return (
		<>
			<textarea
				aria-label="Prompt"
				data-console-prompt=""
				onKeyDown={(event) => {
					if (event.key === "Enter") setOpen(true);
				}}
			/>
			<OverlayContainer
				open={open}
				onDismiss={() => setOpen(false)}
				title=":test"
			>
				<p>content</p>
			</OverlayContainer>
		</>
	);
};

beforeAll(async () => {
	await overlayI18n.ready;
});

describe("OverlayContainer", () => {
	it("gives focus back to the prompt when it closes, since nothing was clicked to open it", async () => {
		renderOverlay(<Host />);
		const prompt = screen.getByRole("textbox", { name: "Prompt" });
		prompt.focus();
		fireEvent.keyDown(prompt, { key: "Enter" });
		expect(await screen.findByRole("dialog")).toBeTruthy();
		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await waitFor(() => expect(document.activeElement).toBe(prompt));
	});

	it("closes on a bare q, but lets q be typed into a field inside the overlay", async () => {
		renderOverlay(
			<OverlayContainer open onDismiss={() => {}} title=":test">
				<input aria-label="Filter" />
			</OverlayContainer>,
		);
		const filter = screen.getByRole("textbox", { name: "Filter" });
		filter.focus();
		fireEvent.keyDown(filter, { key: "q" });
		expect(screen.getByRole("dialog")).toBeTruthy();
	});
});
