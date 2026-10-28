import { afterEach, describe, expect, it, vi } from "vitest";

const runPixel = vi.fn();
vi.mock("@semoss/sdk/react", () => ({
	runPixel: (...args: unknown[]) => runPixel(...args),
}));

const readCapabilityPacks = vi.fn();
vi.mock("@semoss/agent-core", () => ({
	readCapabilityPacks: (...args: unknown[]) => readCapabilityPacks(...args),
}));

import {
	browseRoomFolder,
	getCapabilityPacks,
	getPendingActions,
	getRoomCost,
	getRoomRuns,
} from "./room-data";

/** A runPixel response with one operation. */
const answer = (output: unknown, errors: string[] = []) => ({
	errors,
	insightId: "i",
	pixelReturn: [{ output }],
});

afterEach(() => {
	runPixel.mockReset();
	readCapabilityPacks.mockReset();
});

describe("room data reads", () => {
	it("lists a folder in the room's insight and parses the rows", async () => {
		runPixel.mockResolvedValue(
			answer([{ name: "src", path: "/src/", type: "directory" }]),
		);
		await expect(browseRoomFolder("insight-1", "/src")).resolves.toEqual([
			{ name: "src", path: "/src/", isDirectory: true },
		]);
		expect(runPixel).toHaveBeenCalledWith(
			'BrowseInsightAssets(filePath=["/src"]);',
			"insight-1",
		);
	});

	it("quotes ids so one with a quote in it cannot add Pixel", async () => {
		runPixel.mockResolvedValue(answer([]));
		await getRoomRuns('r"1', "i");
		expect(runPixel).toHaveBeenCalledWith(
			'GetAgentRunsForRoom(roomId=["r\\"1"]);',
			"i",
		);
	});

	it("reads cost for a room", async () => {
		runPixel.mockResolvedValue(
			answer({
				models: [{ modelName: "m", priced: false, llmCalls: 1 }],
			}),
		);
		const summary = await getRoomCost("room-1", "i");
		expect(summary?.pricedCost).toBeNull();
		expect(runPixel).toHaveBeenCalledWith(
			'GetModelCost(roomId=["room-1"]);',
			"i",
		);
	});

	it("reads the pending actions without a room", async () => {
		runPixel.mockResolvedValue(answer([]));
		await expect(getPendingActions()).resolves.toEqual([]);
		expect(runPixel).toHaveBeenCalledWith(
			"GetPendingAgentActions();",
			undefined,
		);
	});

	it("throws the platform's reason when an operation failed", async () => {
		runPixel.mockResolvedValue(answer("nope", ["Not allowed", " here"]));
		await expect(getRoomRuns("room-1")).rejects.toThrow("Not allowed here");
	});
});

describe("getCapabilityPacks", () => {
	it("hands the reader runPixel's response as it is, not wrapped again", async () => {
		const response = answer([{ project_id: "pack-x" }]);
		runPixel.mockResolvedValue(response);
		readCapabilityPacks.mockImplementation(
			async (runner: {
				actions: { run: (p: string) => Promise<unknown> };
			}) => {
				// the reader reads pixelReturn[0].output of what run() returns
				expect(await runner.actions.run("META | MyProjects();")).toBe(
					response,
				);
				return [{ id: "pack-x" }];
			},
		);
		await expect(getCapabilityPacks("i")).resolves.toEqual([
			{ id: "pack-x" },
		]);
		expect(runPixel).toHaveBeenCalledWith("META | MyProjects();", "i");
	});

	it("reports a failed read instead of an empty list", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		readCapabilityPacks.mockImplementation(
			async (
				_runner: unknown,
				onError: (m: string, e: unknown) => void,
			) => {
				onError("Failed to load capability packs", new Error("denied"));
				return [];
			},
		);
		await expect(getCapabilityPacks()).rejects.toThrow("denied");
		warn.mockRestore();
	});

	it("keeps the packs it found when another one failed", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		readCapabilityPacks.mockImplementation(
			async (
				_runner: unknown,
				onError: (m: string, e: unknown) => void,
			) => {
				onError("Failed to read a pack", new Error("one bad pack"));
				return [{ id: "pack-ok" }];
			},
		);
		await expect(getCapabilityPacks()).resolves.toEqual([
			{ id: "pack-ok" },
		]);
		warn.mockRestore();
	});
});
