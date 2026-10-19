import { describe, expect, it, vi } from "vitest";
import type { PendingAgentAction } from "@semoss/sdk";
import { syncPendingActions } from "./agent-harness";

const nativeAction = (toolCallId: string): PendingAgentAction =>
	({
		actionId: `a-${toolCallId}`,
		runId: "r1",
		parentMessageId: null,
		toolCallId,
		toolName: "Bash",
		toolArgs: { command: "echo hi > a.txt" },
		editedArgs: null,
		toolMeta: { SMSS_HARNESS_NATIVE: "claude_code" },
		hasUi: false,
		uiUrl: null,
		status: "PENDING",
	}) as PendingAgentAction;

const part = (id: string, meta: Record<string, unknown>) => ({
	type: "TOOL_CALL" as const,
	toolCall: { id, type: "function", name: "Bash", _meta: meta },
});

const setup = (
	parts: ReturnType<typeof part>[],
	statuses: Record<string, string>,
) => {
	const tools = new Map(
		Object.entries(statuses).map(([id, status]) => [
			id,
			{ id, status, pendingAction: null as PendingAgentAction | null },
		]),
	);
	const room = {
		syncTool: vi.fn(),
		getTool: (id: string) => tools.get(id),
	};
	const message = { room, parts } as never;
	return { message, tools, room, parts };
};

const NATIVE_META = { SMSS_HARNESS_NATIVE: "claude_code" };

describe("syncPendingActions", () => {
	it("builds an approval row for a pending call that has no row yet", () => {
		const { message, room, parts } = setup([], {});
		syncPendingActions(message, [nativeAction("t1")]);
		expect(parts).toHaveLength(1);
		expect(room.syncTool).toHaveBeenCalledTimes(1);
	});

	it("removes a harness-run call's approval row once it is no longer pending", () => {
		const { message, parts } = setup([part("t1", NATIVE_META)], {
			t1: "INITIAL",
		});
		syncPendingActions(message, []);
		expect(parts).toHaveLength(0);
	});

	it("keeps the row while it is still pending", () => {
		const { message, parts, tools } = setup([part("t1", NATIVE_META)], {
			t1: "INITIAL",
		});
		syncPendingActions(message, [nativeAction("t1")]);
		expect(parts).toHaveLength(1);
		expect(tools.get("t1")?.pendingAction?.actionId).toBe("a-t1");
	});

	it("keeps a rejected call, which the stream marks cancelled", () => {
		const { message, parts } = setup([part("t1", NATIVE_META)], {
			t1: "CANCELLED",
		});
		syncPendingActions(message, []);
		expect(parts).toHaveLength(1);
	});

	it("never removes a call that is not harness-run", () => {
		const { message, parts } = setup(
			[part("t1", { SMSS_MCP_EXECUTION: "agent-ask" }), part("t2", {})],
			{ t1: "INITIAL", t2: "INITIAL" },
		);
		syncPendingActions(message, []);
		expect(parts).toHaveLength(2);
	});
});
