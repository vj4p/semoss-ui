// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordingProjectOption } from "../../types/browserEvents";
import { SaveRecordingDialog } from "./SaveRecordingDialog";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Radix measures with these; jsdom has neither.
beforeEach(() => {
	globalThis.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
	Element.prototype.hasPointerCapture ??= () => false;
	Element.prototype.scrollIntoView ??= () => {};
});

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

const app: RecordingProjectOption = { label: "Support app", value: "app-1" };

type Props = Parameters<typeof SaveRecordingDialog>[0];

function props(overrides: Partial<Props> = {}): Props {
	return {
		open: true,
		projects: [app],
		project: app,
		models: [],
		model: null,
		title: "Submit a request",
		fileName: "submit-a-request",
		description: "Files a support request",
		intent: "Get help quickly",
		isLoadingProjects: false,
		isLoadingModels: false,
		isGeneratingMetadata: false,
		isSaving: false,
		canSave: true,
		showPlaygroundDestinations: false,
		destination: "playground-and-app",
		onClose: vi.fn(),
		onProjectChange: vi.fn(),
		onModelChange: vi.fn(),
		onTitleChange: vi.fn(),
		onDescriptionChange: vi.fn(),
		onIntentChange: vi.fn(),
		onGenerateMetadata: vi.fn(),
		onDestinationChange: vi.fn(),
		onSave: vi.fn(),
		...overrides,
	};
}

function renderDialog(overrides: Partial<Props> = {}) {
	const value = props(overrides);
	act(() => {
		root.render(<SaveRecordingDialog {...value} />);
	});
	return value;
}

/** The dialog is portalled, so every query starts at the document. */
const status = (): HTMLElement | null => document.body.querySelector("output");
const buttonNamed = (name: string): HTMLButtonElement | undefined =>
	Array.from(document.body.querySelectorAll("button")).find(
		(button) => button.textContent?.trim() === name,
	);

describe("SaveRecordingDialog project field", () => {
	it("associates the Project label with its select", () => {
		renderDialog();
		const label = Array.from(document.body.querySelectorAll("label")).find(
			(candidate) => candidate.textContent === "Project",
		);
		const trigger = document.body.querySelector('[role="combobox"]');
		expect(label?.htmlFor).toBeTruthy();
		expect(trigger?.id).toBe(label?.htmlFor);
	});

	it("tells the person they need an app they can edit when there are none", () => {
		renderDialog({ projects: [], project: null });
		const alert = document.body.querySelector('[role="alert"]');
		expect(alert?.textContent).toContain("No app you can edit");
		expect(alert?.textContent).toContain("edit access");
		// no empty select to puzzle over
		const labels = Array.from(document.body.querySelectorAll("label"));
		expect(labels.some((label) => label.textContent === "Project")).toBe(
			false,
		);
		// outside Playground there is nowhere else to save, so no shortcut either
		expect(buttonNamed("Save to Playground only")).toBeUndefined();
	});

	it("offers saving to Playground only when that is a destination", () => {
		const value = renderDialog({
			projects: [],
			project: null,
			showPlaygroundDestinations: true,
		});
		const shortcut = buttonNamed("Save to Playground only");
		expect(shortcut).toBeDefined();
		act(() => shortcut?.click());
		expect(value.onDestinationChange).toHaveBeenCalledWith("playground");
	});

	it("shows no empty-state while projects are still loading, or when the app is not needed", () => {
		renderDialog({
			projects: [],
			project: null,
			isLoadingProjects: true,
		});
		expect(document.body.querySelector('[role="alert"]')).toBeNull();
		renderDialog({
			projects: [],
			project: null,
			showPlaygroundDestinations: true,
			destination: "playground",
		});
		expect(document.body.querySelector('[role="alert"]')).toBeNull();
		expect(document.body.textContent).not.toContain("Project");
	});
});

describe("SaveRecordingDialog missing-details hint", () => {
	it("names what the Save button is waiting for", () => {
		renderDialog({ title: "", intent: "  ", project: null });
		expect(status()?.textContent).toBe(
			"Still needed to save: project, title, intent.",
		);
		expect(buttonNamed("Save")?.disabled).toBe(true);
	});

	it("updates as details are filled in and goes quiet when nothing is missing", () => {
		renderDialog({ title: "", description: "" });
		expect(status()?.textContent).toBe(
			"Still needed to save: title, description.",
		);
		renderDialog({ description: "" });
		expect(status()?.textContent).toBe(
			"Still needed to save: description.",
		);
		renderDialog();
		expect(status()?.textContent).toBe("");
		expect(buttonNamed("Save")?.disabled).toBe(false);
	});

	it("does not ask for a project when saving to Playground only", () => {
		renderDialog({
			project: null,
			showPlaygroundDestinations: true,
			destination: "playground",
		});
		expect(status()?.textContent).toBe("");
		expect(buttonNamed("Save")?.disabled).toBe(false);
	});
});
