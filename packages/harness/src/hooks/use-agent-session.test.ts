import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useAgentSession } from "./use-agent-session";

const mockStart = vi.fn();

// Hoisted by Vitest above every import in this file (including the
// `useAgentSession` import above), so the hook always sees this mock.
vi.mock("@semoss/sdk", () => ({
	AgentStore: { start: (...args: unknown[]) => mockStart(...args) },
}));

test("accumulates items as onEvent fires and reflects RUNNING then DONE", async () => {
	let capturedHandlers: {
		onEvent?: (
			event: unknown,
			items: { itemOrder: string[]; itemsById: Record<string, unknown> },
		) => void;
		onReconcile?: (snapshot: { status: string }) => void;
	} = {};

	mockStart.mockResolvedValue({
		watch: (handlers: typeof capturedHandlers) => {
			capturedHandlers = handlers;
			return {
				stop: vi.fn(),
				getItems: vi.fn(),
				pokeNow: vi.fn(),
				done: Promise.resolve(null),
			};
		},
	});

	const { result } = renderHook(() => useAgentSession("room-1", "insight-1"));

	await act(async () => {
		await result.current.send("say hi");
	});

	expect(result.current.status).toBe("RUNNING");

	act(() => {
		capturedHandlers.onEvent?.(
			{ type: "item.started" },
			{
				itemOrder: ["tool-1"],
				itemsById: {
					"tool-1": {
						id: "tool-1",
						kind: "tool",
						name: "edit_file",
						status: "RUNNING",
						arguments: {},
					},
				},
			},
		);
	});

	expect(result.current.items).toHaveLength(1);
	expect(result.current.items[0]).toMatchObject({
		kind: "tool",
		name: "edit_file",
		status: "RUNNING",
	});

	act(() => {
		capturedHandlers.onReconcile?.({ status: "COMPLETED" });
	});

	await waitFor(() => expect(result.current.status).toBe("DONE"));
});
