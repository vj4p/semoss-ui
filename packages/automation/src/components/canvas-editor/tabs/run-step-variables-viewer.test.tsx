// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AutomationStepVariable } from "../../../domain/automation.types";
import { RunStepVariablesViewer } from "./run-step-variables-viewer";

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

const variable = (
	overrides: Partial<AutomationStepVariable>,
): AutomationStepVariable => ({
	name: "city",
	kind: "string",
	value: "Ashburn",
	redacted: false,
	truncated: false,
	...overrides,
});

function renderViewer(variables: AutomationStepVariable[], omitted?: number) {
	act(() => {
		root.render(
			<RunStepVariablesViewer variables={variables} omitted={omitted} />,
		);
	});
}

const headers = (): string[] =>
	Array.from(container.querySelectorAll("th")).map(
		(cell) => cell.textContent ?? "",
	);
const rows = (): string[][] =>
	Array.from(container.querySelectorAll("tbody tr")).map((row) =>
		Array.from(row.querySelectorAll("td")).map(
			(cell) => cell.textContent ?? "",
		),
	);

describe("RunStepVariablesViewer", () => {
	it("lists each variable with its type and value under named columns", () => {
		renderViewer([
			variable({}),
			variable({ name: "count", kind: "number", value: "3" }),
		]);
		const region = container.querySelector("section");
		expect(region?.getAttribute("aria-label")).toBe("Step variables");
		expect(region?.tabIndex).toBe(0);
		expect(headers()).toEqual(["Name", "Type", "Value"]);
		expect(rows()).toEqual([
			["city", "string", "Ashburn"],
			["count", "number", "3"],
		]);
	});

	it("shows a hidden secret as Hidden, never its value", () => {
		renderViewer([
			variable({ name: "api_key", value: "sk-live-123", redacted: true }),
		]);
		expect(rows()).toEqual([["api_key", "string", "Hidden"]]);
		expect(container.textContent).not.toContain("sk-live-123");
	});

	it("says when a value is shortened, dropped or unset", () => {
		renderViewer([
			variable({ name: "long", value: "abc", truncated: true }),
			variable({ name: "big", value: null, truncated: true }),
			variable({ name: "empty", kind: "null", value: null }),
		]);
		const values = rows().map((row) => row[2]);
		expect(values[0]).toContain("abc");
		expect(values[0]).toContain("(shortened)");
		expect(values[1]).toBe("Too large to keep");
		expect(values[2]).toBe("Not set");
	});

	it("counts variables that were not kept", () => {
		renderViewer([variable({})], 4);
		expect(container.textContent).toContain(
			"4 more variables were not kept.",
		);
	});

	it("says so, instead of showing an empty table, when the step started with none", () => {
		renderViewer([]);
		expect(container.querySelector("table")).toBeNull();
		expect(container.textContent).toContain(
			"This step started with no variables.",
		);
	});
});
