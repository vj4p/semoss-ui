import { describe, expect, it } from "vitest";
import { summarizeCost } from "./cost-summary";
import { parsePendingActions } from "./pending-actions";
import {
	browseRoomFolderPixel,
	folderPathOf,
	parseRoomFolderListing,
} from "./room-files";
import { parseRoomRuns } from "./room-runs";
import { formatAgo, parseServerTime } from "./server-time";

describe("parseServerTime", () => {
	it("reads a zone-less database time as UTC, keeping the milliseconds", () => {
		expect(
			parseServerTime("2026-09-12 03:47:56.368990")?.toISOString(),
		).toBe("2026-09-12T03:47:56.368Z");
	});

	it("reads a time with no fraction", () => {
		expect(parseServerTime("2026-09-12 03:47:56")?.toISOString()).toBe(
			"2026-09-12T03:47:56.000Z",
		);
	});

	it("keeps a zone the value states", () => {
		expect(
			parseServerTime("2026-09-12T03:47:56+02:00")?.toISOString(),
		).toBe("2026-09-12T01:47:56.000Z");
	});

	it("returns nothing for what is not a time", () => {
		expect(parseServerTime(undefined)).toBeUndefined();
		expect(parseServerTime("yesterday")).toBeUndefined();
		expect(parseServerTime(42)).toBeUndefined();
	});
});

describe("formatAgo", () => {
	const now = new Date("2026-09-12T12:00:00Z");
	it.each([
		["2026-09-12T11:59:40Z", "just now"],
		["2026-09-12T11:55:00Z", "5m ago"],
		["2026-09-12T09:00:00Z", "3h ago"],
		["2026-09-10T12:00:00Z", "2d ago"],
		["2026-09-12T12:00:30Z", "just now"],
	])("%s reads as %s", (then, expected) => {
		expect(formatAgo(new Date(then), now)).toBe(expected);
	});
});

describe("room folder listing", () => {
	it("quotes the folder so a file name cannot add Pixel", () => {
		expect(browseRoomFolderPixel('/a"b')).toBe(
			'BrowseInsightAssets(filePath=["/a\\"b"]);',
		);
	});

	it("reads directories and files from the reactor's rows", () => {
		expect(
			parseRoomFolderListing([
				{ path: "/src/", name: "src", type: "directory" },
				{ path: "/README.md", name: "README.md", type: "md" },
			]),
		).toEqual([
			{ path: "/src/", name: "src", isDirectory: true },
			{ path: "/README.md", name: "README.md", isDirectory: false },
		]);
	});

	it("drops rows it cannot draw and reads a non-list as empty", () => {
		expect(
			parseRoomFolderListing([null, { name: "x" }, { path: "/y" }, 7]),
		).toEqual([]);
		expect(
			parseRoomFolderListing("The filepath passed in is invalid"),
		).toEqual([]);
	});

	it("lists a directory again without its trailing slash", () => {
		expect(
			folderPathOf({ path: "/src/lib/", name: "lib", isDirectory: true }),
		).toBe("/src/lib");
	});
});

describe("parseRoomRuns", () => {
	const run = (over: Record<string, unknown>) => ({
		runId: "r1",
		status: "COMPLETED",
		input: "hello",
		startedAt: "2026-09-12 03:47:56.000000",
		completedAt: "2026-09-12 03:50:44.500000",
		...over,
	});

	it("lists the newest run first", () => {
		const runs = parseRoomRuns([
			run({ runId: "old" }),
			run({ runId: "new" }),
		]);
		expect(runs.map((r) => r.id)).toEqual(["new", "old"]);
	});

	it("measures a finished run from its two ends", () => {
		expect(parseRoomRuns([run({})])[0].durationMs).toBe(168_500);
	});

	it("gives a run that is still going no duration", () => {
		const [r] = parseRoomRuns([
			run({ status: "RUNNING", completedAt: null }),
		]);
		expect(r.durationMs).toBeUndefined();
		expect(r.startedAt).toBeInstanceOf(Date);
	});

	it("falls back to the created time when a run has not started", () => {
		const [r] = parseRoomRuns([
			run({
				startedAt: null,
				completedAt: null,
				dateCreated: "2026-09-12 03:00:00.000000",
			}),
		]);
		expect(r.startedAt?.toISOString()).toBe("2026-09-12T03:00:00.000Z");
	});

	it("skips rows with no run id", () => {
		expect(parseRoomRuns([{ status: "COMPLETED" }, null])).toEqual([]);
	});
});

describe("summarizeCost", () => {
	const model = (over: Record<string, unknown>) => ({
		modelId: "m1",
		modelName: "Model One",
		llmCalls: 2,
		inputTokens: 100,
		outputTokens: 50,
		priced: true,
		cost: 0.5,
		...over,
	});

	it("does not show a room on an unpriced model as costing nothing", () => {
		const summary = summarizeCost({
			models: [model({ priced: false, cost: undefined })],
		});
		expect(summary?.pricedCost).toBeNull();
		expect(summary?.models[0].cost).toBeNull();
		expect(summary?.complete).toBe(false);
		expect(summary?.unpricedModels).toBe(1);
	});

	it("totals a fully priced room", () => {
		const summary = summarizeCost({
			models: [model({}), model({ modelId: "m2", cost: 0.25 })],
		});
		expect(summary?.pricedCost).toBe(0.75);
		expect(summary?.complete).toBe(true);
		expect(summary?.totalTokens).toBe(300);
		expect(summary?.totalCalls).toBe(4);
	});

	it("marks a partly priced room as a minimum", () => {
		const summary = summarizeCost({
			models: [
				model({}),
				model({ modelId: "m2", priced: false, cost: undefined }),
			],
		});
		expect(summary?.pricedCost).toBe(0.5);
		expect(summary?.complete).toBe(false);
		expect(summary?.unpricedModels).toBe(1);
	});

	it("treats a real zero cost as priced", () => {
		const summary = summarizeCost({ models: [model({ cost: 0 })] });
		expect(summary?.pricedCost).toBe(0);
		expect(summary?.complete).toBe(true);
	});

	it("reads a response with no models as nothing", () => {
		expect(summarizeCost(null)).toBeNull();
		expect(summarizeCost({})).toBeNull();
		expect(summarizeCost({ models: [] })?.complete).toBe(false);
	});
});

describe("parsePendingActions", () => {
	it("reads the actions waiting on the user", () => {
		expect(
			parsePendingActions([
				{
					actionId: "a1",
					roomId: "room-1",
					toolName: "Write",
					dateCreated: "2026-09-12 03:47:56.000000",
				},
			]),
		).toEqual([
			{
				id: "a1",
				roomId: "room-1",
				tool: "Write",
				createdAt: new Date("2026-09-12T03:47:56.000Z"),
			},
		]);
	});

	it("names an action with no tool and skips rows with no room", () => {
		const [action, ...rest] = parsePendingActions([
			{ actionId: "a1", roomId: "r" },
			{ actionId: "a2" },
		]);
		expect(action.tool).toBe("a tool");
		expect(rest).toEqual([]);
	});
});
