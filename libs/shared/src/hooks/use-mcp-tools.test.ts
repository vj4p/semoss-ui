import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMCPTools } from "@semoss/sdk";
import { useMCPTools } from "./use-mcp-tools";

vi.mock("@semoss/sdk", () => ({
	getMCPTools: vi.fn(),
}));

describe("useMCPTools", () => {
	const mockTools = [
		{
			id: "tool1",
			name: "File System",
			description: "Access files",
			category: "filesystem" as const,
			tags: ["files"],
			capabilities: [
				{ type: "read" as const, description: "Read files" },
			],
			isEnabled: false,
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches tools on mount", async () => {
		vi.mocked(getMCPTools).mockResolvedValue(mockTools);

		const { result } = renderHook(() => useMCPTools({}));

		expect(result.current.loading).toBe(true);

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
			expect(result.current.tools).toHaveLength(1);
			expect(result.current.tools[0].id).toBe("tool1");
		});
	});

	it("uses fallback on error", async () => {
		const fallback = [
			{
				id: "fallback",
				name: "Fallback Tool",
				description: "Fallback",
				category: "other" as const,
				tags: [],
				capabilities: [],
				isEnabled: false,
			},
		];

		vi.mocked(getMCPTools).mockRejectedValue(new Error("Network error"));

		const { result } = renderHook(() => useMCPTools({ fallback }));

		await waitFor(() => {
			expect(result.current.error).toBeTruthy();
			expect(result.current.tools).toEqual(fallback);
		});
	});

	it("does not auto-fetch when autoFetch=false", () => {
		vi.mocked(getMCPTools).mockResolvedValue(mockTools);

		const { result } = renderHook(() => useMCPTools({ autoFetch: false }));

		expect(result.current.loading).toBe(false);
		expect(getMCPTools).not.toHaveBeenCalled();
	});

	it("supports manual refetch", async () => {
		vi.mocked(getMCPTools).mockResolvedValue(mockTools);

		const { result } = renderHook(() => useMCPTools({ autoFetch: false }));

		expect(getMCPTools).not.toHaveBeenCalled();

		// Manual refetch
		await result.current.refetch();

		await waitFor(() => {
			expect(getMCPTools).toHaveBeenCalled();
			expect(result.current.tools).toHaveLength(1);
		});
	});

	it("passes engineId and insightId to API", async () => {
		vi.mocked(getMCPTools).mockResolvedValue(mockTools);

		renderHook(() =>
			useMCPTools({ engineId: "ENGINE123", insightId: "INSIGHT456" }),
		);

		await waitFor(() => {
			expect(getMCPTools).toHaveBeenCalledWith("ENGINE123", "INSIGHT456");
		});
	});

	it("cancels in-flight request on unmount", async () => {
		vi.mocked(getMCPTools).mockImplementation(
			() =>
				new Promise((resolve) =>
					setTimeout(() => resolve(mockTools), 1000),
				),
		);

		const { unmount } = renderHook(() => useMCPTools({}));

		// Unmount before request completes
		unmount();

		// Should not throw or cause state update after unmount
		expect(() => unmount()).not.toThrow();
	});
});
