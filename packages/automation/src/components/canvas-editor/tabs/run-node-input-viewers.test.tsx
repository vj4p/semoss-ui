// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AutomationStepVariable } from "../../../domain/automation.types";
import {
	RunInputViewer,
	RunStepVariablesViewer,
} from "./run-node-input-viewers";

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

describe("RunInputViewer", () => {
	it("pretty-prints stored JSON in a labelled, keyboard-reachable region", () => {
		const html = renderToStaticMarkup(
			<RunInputViewer runInput='{"city":"Ashburn"}' />,
		);
		expect(html).toContain('aria-label="Run input"');
		expect(html).toContain('tabindex="0"');
		expect(html).toContain("&quot;city&quot;: &quot;Ashburn&quot;");
		expect(html).toContain("secrets are hidden");
	});

	it("shows text that is not JSON as it is", () => {
		expect(
			renderToStaticMarkup(<RunInputViewer runInput="plain text" />),
		).toContain("plain text");
	});
});

describe("RunStepVariablesViewer", () => {
	it("lists each variable with its type and value", () => {
		const html = renderToStaticMarkup(
			<RunStepVariablesViewer
				variables={[
					variable({}),
					variable({ name: "count", kind: "number", value: "3" }),
				]}
			/>,
		);
		expect(html).toContain('aria-label="Step variables"');
		expect(html).toContain("Ashburn");
		expect(html).toContain("number");
		expect(html).toContain("count");
	});

	it("shows a hidden secret as Hidden, never its value", () => {
		const html = renderToStaticMarkup(
			<RunStepVariablesViewer
				variables={[
					variable({
						name: "api_key",
						value: "sk-live-123",
						redacted: true,
					}),
				]}
			/>,
		);
		expect(html).toContain("Hidden");
		expect(html).not.toContain("sk-live-123");
	});

	it("says when a value is shortened, dropped or unset", () => {
		const html = renderToStaticMarkup(
			<RunStepVariablesViewer
				variables={[
					variable({ name: "long", value: "abc", truncated: true }),
					variable({ name: "big", value: null, truncated: true }),
					variable({ name: "empty", kind: "null", value: null }),
				]}
			/>,
		);
		expect(html).toContain("(shortened)");
		expect(html).toContain("Too large to keep");
		expect(html).toContain("Not set");
	});

	it("counts variables that were not kept, and handles none", () => {
		expect(
			renderToStaticMarkup(
				<RunStepVariablesViewer
					variables={[variable({})]}
					omitted={4}
				/>,
			),
		).toContain("4 more variables were not kept.");
		expect(
			renderToStaticMarkup(<RunStepVariablesViewer variables={[]} />),
		).toContain("This step started with no variables.");
	});
});
