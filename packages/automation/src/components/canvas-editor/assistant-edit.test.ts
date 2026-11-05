import { describe, expect, it } from "vitest";
import { isAssistantEdit } from "./assistant-edit";

describe("isAssistantEdit", () => {
	it.each(["reload", "undo", "rollback"])(
		"treats %s as the canvas's own operation, so Undo is not offered",
		(toolName) => {
			expect(isAssistantEdit(toolName)).toBe(false);
		},
	);

	it.each(["AddAutomationStep", "UpdateAutomationStep", "anything-else"])(
		"treats %s as an assistant edit",
		(toolName) => {
			expect(isAssistantEdit(toolName)).toBe(true);
		},
	);
});
