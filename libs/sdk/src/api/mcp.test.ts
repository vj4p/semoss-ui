import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMCPTools, getRoomMCPTools, setRoomMCPTools } from "./mcp";
import { runPixel } from "./pixel";

vi.mock("./pixel");

describe("mcp API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getMCPTools", () => {
		it("fetches tools without engineId", async () => {
			const mockResult = {
				tools: [
					{
						id: "fs_tool",
						name: "File System",
						description: "Access files",
						category: "filesystem",
						tags: ["files", "io"],
						capabilities: [
							{ type: "read", description: "Read files" },
						],
						isEnabled: false,
					},
				],
			};

			vi.mocked(runPixel).mockResolvedValue(mockResult);

			const result = await getMCPTools();

			expect(runPixel).toHaveBeenCalledWith("GetMCPTools();", {
				insightId: undefined,
			});
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("fs_tool");
			expect(result[0].category).toBe("filesystem");
		});

		it("fetches tools with engineId", async () => {
			const mockResult = { tools: [] };
			vi.mocked(runPixel).mockResolvedValue(mockResult);

			await getMCPTools("ENGINE123", "INSIGHT456");

			expect(runPixel).toHaveBeenCalledWith(
				'GetMCPTools(engine="ENGINE123");',
				{
					insightId: "INSIGHT456",
				},
			);
		});

		it("returns empty array on error", async () => {
			vi.mocked(runPixel).mockRejectedValue(new Error("Network error"));

			const result = await getMCPTools();

			expect(result).toEqual([]);
		});

		it("handles missing tools field", async () => {
			vi.mocked(runPixel).mockResolvedValue({});

			const result = await getMCPTools();

			expect(result).toEqual([]);
		});
	});

	describe("setRoomMCPTools", () => {
		it("sends tool IDs to backend", async () => {
			vi.mocked(runPixel).mockResolvedValue({});

			await setRoomMCPTools("ROOM123", ["tool1", "tool2"]);

			expect(runPixel).toHaveBeenCalledWith(
				'SetRoomMCPTools(roomId="ROOM123", tools=["tool1","tool2"]);',
				{ insightId: undefined },
			);
		});

		it("handles empty tool list", async () => {
			vi.mocked(runPixel).mockResolvedValue({});

			await setRoomMCPTools("ROOM123", []);

			expect(runPixel).toHaveBeenCalledWith(
				'SetRoomMCPTools(roomId="ROOM123", tools=[]);',
				{ insightId: undefined },
			);
		});
	});

	describe("getRoomMCPTools", () => {
		it("fetches enabled tools for room", async () => {
			vi.mocked(runPixel).mockResolvedValue({
				tools: ["tool1", "tool2"],
			});

			const result = await getRoomMCPTools("ROOM123");

			expect(runPixel).toHaveBeenCalledWith(
				'GetRoomMCPTools(roomId="ROOM123");',
				{ insightId: undefined },
			);
			expect(result).toEqual(["tool1", "tool2"]);
		});

		it("returns empty array when no tools", async () => {
			vi.mocked(runPixel).mockResolvedValue({});

			const result = await getRoomMCPTools("ROOM123");

			expect(result).toEqual([]);
		});
	});
});
