// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	AutomationNode,
	AutomationNodeResult,
} from "../../../domain/automation.types";
import { ResultsPanel } from "./runs-tab";

// The output renderer pulls in editors that jsdom cannot host; the panel only
// needs to know that it was asked to show the preview.
vi.mock("@semoss/shared", () => ({
	CellOutputBlock: ({ output }: { output: string }) => <pre>{output}</pre>,
}));

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

function result(
	overrides: Partial<AutomationNodeResult> = {},
): AutomationNodeResult {
	return {
		NODE_ID: "step-1",
		NODE_LABEL: "Fetch rows",
		STATUS: "SUCCESS",
		DURATION_MS: 10,
		OUTPUT_PREVIEW: "42 rows",
		ERROR_MESSAGE: null,
		...overrides,
	};
}

interface PanelOptions {
	runInput?: string;
	devMode?: boolean;
	results?: AutomationNodeResult[];
	selectedId?: string;
}

function renderPanel({
	runInput,
	devMode = false,
	results = [result()],
	selectedId = "step-1",
}: PanelOptions = {}) {
	act(() => {
		root.render(
			<ResultsPanel
				appId="app-1"
				devMode={devMode}
				runId="run-1"
				executionInsightId={null}
				savedResults={[]}
				runInput={runInput}
				results={results}
				selectedResult={
					results.find((entry) => entry.NODE_ID === selectedId) ??
					null
				}
				stepMap={new Map<string, AutomationNode>()}
				onOutputPopout={() => undefined}
				onSelectNode={() => undefined}
			/>,
		);
	});
}

const tabs = (): HTMLElement[] =>
	Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
const tabNamed = (name: string): HTMLElement | undefined =>
	tabs().find((tab) => tab.textContent === name);
/** Radix keeps an empty, hidden panel for every tab; only the shown one counts. */
const panel = (): HTMLElement | null =>
	container.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])');

/** Presses a key on a tab. Roving focus moves focus on the next tick. */
async function pressKey(target: HTMLElement, key: string) {
	await act(async () => {
		target.focus();
		target.dispatchEvent(
			new KeyboardEvent("keydown", { key, bubbles: true }),
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

const withVariables = result({
	inputVariables: [
		{
			name: "city",
			kind: "string",
			value: "Ashburn",
			redacted: false,
			truncated: false,
		},
	],
});

describe("ResultsPanel detail views", () => {
	it("shows no tabs when the backend sent no input or variables and there is no developer mode", () => {
		renderPanel();
		expect(tabs()).toHaveLength(0);
		expect(container.textContent).toContain("42 rows");
	});

	it("offers Input when the run has an input, and Variables when the step has them", () => {
		renderPanel({
			runInput: '{"city":"Ashburn"}',
			results: [withVariables],
		});
		expect(tabs().map((tab) => tab.textContent)).toEqual([
			"Output",
			"Input",
			"Variables",
		]);
	});

	it("offers only Input when the step has no variables, and only Variables when the run has no input", () => {
		renderPanel({ runInput: '{"a":1}' });
		expect(tabs().map((tab) => tab.textContent)).toEqual([
			"Output",
			"Input",
		]);
		renderPanel({ results: [withVariables] });
		expect(tabs().map((tab) => tab.textContent)).toEqual([
			"Output",
			"Variables",
		]);
	});

	it("adds Implementation only in developer mode", () => {
		renderPanel({ devMode: true });
		expect(tabs().map((tab) => tab.textContent)).toEqual([
			"Output",
			"Implementation",
		]);
	});

	it("names the tab list and connects each tab to a tabpanel", () => {
		renderPanel({
			runInput: '{"city":"Ashburn"}',
			results: [withVariables],
		});
		expect(
			container
				.querySelector('[role="tablist"]')
				?.getAttribute("aria-label"),
		).toBe("Run node detail view");
		const selected = tabs().find(
			(tab) => tab.getAttribute("aria-selected") === "true",
		);
		const labelledPanel = panel();
		expect(selected?.textContent).toBe("Output");
		expect(labelledPanel).not.toBeNull();
		expect(selected?.getAttribute("aria-controls")).toBe(labelledPanel?.id);
		expect(labelledPanel?.getAttribute("aria-labelledby")).toBe(
			selected?.id,
		);
	});

	it("mounts only the selected view", () => {
		renderPanel({
			runInput: '{"city":"Ashburn"}',
			results: [withVariables],
		});
		expect(
			container.querySelectorAll('[role="tabpanel"]:not([hidden])'),
		).toHaveLength(1);
		expect(container.querySelector('[aria-label="Run input"]')).toBeNull();
		expect(
			container.querySelector('[aria-label="Step variables"]'),
		).toBeNull();
	});

	it("moves between tabs with the arrow keys and shows that view in the panel", async () => {
		renderPanel({
			runInput: '{"city":"Ashburn"}',
			results: [withVariables],
		});
		const output = tabNamed("Output");
		if (!output) throw new Error("no Output tab");
		await pressKey(output, "ArrowRight");

		const input = tabNamed("Input");
		expect(input?.getAttribute("aria-selected")).toBe("true");
		expect(document.activeElement).toBe(input);
		expect(
			panel()?.querySelector('[aria-label="Run input"]'),
		).not.toBeNull();

		if (!input) throw new Error("no Input tab");
		await pressKey(input, "ArrowRight");
		expect(tabNamed("Variables")?.getAttribute("aria-selected")).toBe(
			"true",
		);
		expect(
			panel()?.querySelector('[aria-label="Step variables"]'),
		).not.toBeNull();
		expect(container.querySelector('[aria-label="Run input"]')).toBeNull();

		const variables = tabNamed("Variables");
		if (!variables) throw new Error("no Variables tab");
		await pressKey(variables, "ArrowLeft");
		expect(tabNamed("Input")?.getAttribute("aria-selected")).toBe("true");
	});

	it("hides the run's Input while a step inside a loop iteration is selected, and brings it back with the loop", () => {
		const body = result({
			NODE_ID: "body-1",
			NODE_LABEL: "Body step",
			OUTPUT_PREVIEW: "inside the loop",
		});
		const loop = result({
			NODE_ID: "loop-1",
			NODE_LABEL: "Each city",
			iterations: [{ index: 0, nodeResults: [body] }],
		});
		renderPanel({
			runInput: '{"city":"Ashburn"}',
			results: [loop],
			selectedId: "loop-1",
		});
		expect(tabNamed("Input")).toBeDefined();

		const click = (element: Element | null | undefined) => {
			if (!element) throw new Error("element not found");
			act(() => {
				element.dispatchEvent(
					new MouseEvent("click", { bubbles: true }),
				);
			});
		};
		const buttonWithText = (text: string) =>
			Array.from(container.querySelectorAll("button")).find((button) =>
				button.textContent?.includes(text),
			);

		click(container.querySelector('[aria-label^="Expand Each city"]'));
		click(buttonWithText("Iteration 1"));
		click(buttonWithText("Body step"));

		expect(container.textContent).toContain("inside the loop");
		expect(tabNamed("Input")).toBeUndefined();
		// the loop's own row still selects the loop, where Input is offered again
		click(buttonWithText("Each city"));
		expect(tabNamed("Input")).toBeDefined();
	});
});
