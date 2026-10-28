// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RunInputViewer } from "./run-input-viewer";

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

function renderViewer(runInput: string) {
	act(() => {
		root.render(<RunInputViewer runInput={runInput} />);
	});
}

/** The named region (a labelled section) the input is shown in. */
const region = (name: string): HTMLElement | null =>
	container.querySelector<HTMLElement>(`section[aria-label="${name}"]`);

describe("RunInputViewer", () => {
	it("pretty-prints stored JSON in a named region the keyboard can reach", () => {
		renderViewer('{"city":"Ashburn"}');
		const input = region("Run input");
		expect(input).not.toBeNull();
		// a scrollable region must be focusable (2.1.1)
		expect(input?.tabIndex).toBe(0);
		expect(input?.textContent).toContain('"city": "Ashburn"');
		expect(container.textContent).toContain("secrets are hidden");
	});

	it("shows text that is not JSON as it is", () => {
		renderViewer("plain text");
		expect(region("Run input")?.textContent).toBe("plain text");
	});
});
