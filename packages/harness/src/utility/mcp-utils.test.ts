import { describe, expect, it } from "vitest";
import { isAgentOwnedTool, isHarnessNativeAction } from "./mcp-utils";

describe("isHarnessNativeAction", () => {
	it("is true only for an action tagged by a harness that runs its own tools", () => {
		expect(
			isHarnessNativeAction({
				toolMeta: { SMSS_HARNESS_NATIVE: "claude_code" },
			}),
		).toBe(true);
		expect(isHarnessNativeAction({ toolMeta: {} })).toBe(false);
		expect(isHarnessNativeAction({ toolMeta: null })).toBe(false);
		expect(isHarnessNativeAction(null)).toBe(false);
		expect(isHarnessNativeAction(undefined)).toBe(false);
	});
});

describe("isAgentOwnedTool", () => {
	it("is true for an agent tool with no engine or project behind it", () => {
		expect(
			isAgentOwnedTool({
				SMSS_MCP_EXECUTION: "agent-auto",
				SMSS_ENGINE_ID: "",
				SMSS_PROJECT_ID: "",
			}),
		).toBe(true);
		expect(isAgentOwnedTool({ SMSS_MCP_EXECUTION: "agent-ask" })).toBe(
			true,
		);
	});

	it("is false for a toolbox tool, even one an agent ran", () => {
		expect(
			isAgentOwnedTool({
				SMSS_MCP_EXECUTION: "agent-auto",
				SMSS_ENGINE_ID: "app-filesystem",
			}),
		).toBe(false);
		expect(
			isAgentOwnedTool({
				SMSS_MCP_EXECUTION: "agent-auto",
				SMSS_PROJECT_ID: "p1",
			}),
		).toBe(false);
	});

	it("is false for a chat tool and when nothing is known", () => {
		expect(isAgentOwnedTool({ SMSS_MCP_EXECUTION: "auto" })).toBe(false);
		expect(isAgentOwnedTool({ SMSS_MCP_EXECUTION: "ask" })).toBe(false);
		expect(isAgentOwnedTool(undefined)).toBe(false);
		expect(isAgentOwnedTool({})).toBe(false);
	});
});
