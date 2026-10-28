// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UndoBanner } from "./undo-banner";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function renderBanner(busy: boolean) {
	const onUndo = vi.fn();
	const onDismiss = vi.fn();
	act(() => {
		root.render(
			<UndoBanner busy={busy} onUndo={onUndo} onDismiss={onDismiss} />,
		);
	});
	return { onUndo, onDismiss };
}

const buttons = (): HTMLButtonElement[] =>
	Array.from(container.querySelectorAll("button"));
const buttonNamed = (name: string): HTMLButtonElement | undefined =>
	buttons().find(
		(button) =>
			(button.getAttribute("aria-label") ?? button.textContent) === name,
	);
const click = (button: HTMLButtonElement | undefined) => {
	if (!button) throw new Error("button not found");
	act(() => {
		button.click();
	});
};

describe("UndoBanner", () => {
	it("is a status region, so progress is announced", () => {
		renderBanner(false);
		// <output> carries the implicit status role
		expect(container.querySelector("output")).not.toBeNull();
		expect(container.textContent).toContain("AI updated your automation.");
	});

	it("offers Undo and a named Dismiss, with a decorative icon", () => {
		const { onUndo, onDismiss } = renderBanner(false);
		const undo = buttonNamed("Undo");
		const dismiss = buttonNamed("Dismiss");
		expect(undo?.disabled).toBe(false);
		expect(dismiss?.disabled).toBe(false);
		expect(dismiss?.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
			"true",
		);
		click(undo);
		click(dismiss);
		expect(onUndo).toHaveBeenCalledOnce();
		expect(onDismiss).toHaveBeenCalledOnce();
	});

	it("says Undoing... and disables both buttons while the undo is saving", () => {
		const { onUndo, onDismiss } = renderBanner(true);
		const undoing = buttonNamed("Undoing...");
		const dismiss = buttonNamed("Dismiss");
		expect(undoing?.disabled).toBe(true);
		expect(dismiss?.disabled).toBe(true);
		click(undoing);
		click(dismiss);
		expect(onUndo).not.toHaveBeenCalled();
		expect(onDismiss).not.toHaveBeenCalled();
		expect(container.querySelector("output")?.textContent).toContain(
			"Undoing...",
		);
	});
});
