import { beforeEach, describe, expect, it, vi } from "vitest";
import { runPixel } from "@semoss/sdk/react";
import {
	createRoom,
	getRoomOptions,
	openRoom,
	updateRoomOptions,
	withRoomSettings,
} from "./rooms";

vi.mock("@semoss/sdk/react", () => ({
	runPixel: vi.fn(),
}));

/** A runPixel response, with one operation per output. */
const response = (
	outputs: unknown[],
	{
		errors = [],
		insightId = "insight-1",
	}: { errors?: string[]; insightId?: string } = {},
) => ({
	errors,
	insightId,
	pixelReturn: outputs.map((output, index) => ({
		isMeta: false,
		operationType: ["OPERATION"],
		output,
		pixelExpression: "",
		pixelId: String(index),
		timeToRun: 0,
	})),
});

/** An openRoom response: the room's messages, its options row, the binding. */
const opened = (messages: unknown, row: unknown) =>
	response([messages, row, true]);

const SETTINGS = { harness: "claude_code", modelId: "model-1" };

beforeEach(() => {
	vi.resetAllMocks();
});

describe("withRoomSettings", () => {
	it("saves a new room with what the harness reads", () => {
		expect(withRoomSettings({}, SETTINGS)).toEqual({
			instructions: "",
			mcp: [],
			predefinedPrompts: [],
			harnessType: "claude_code",
			modelId: "model-1",
		});
	});

	it("keeps what other UIs saved, and replaces the harness and the model", () => {
		const options = {
			instructions: "Be brief.",
			mcp: [{ id: "mcp-1", name: "Search", type: "FUNCTION" }],
			predefinedPrompts: ["Summarize the diff"],
			theme: "dark",
			harnessType: "semoss",
			modelId: "model-0",
		};

		expect(withRoomSettings(options, SETTINGS)).toEqual({
			...options,
			harnessType: "claude_code",
			modelId: "model-1",
		});
	});

	it("drops the MCP servers that are only reported, never stored", () => {
		const stored = { id: "mcp-1", name: "Search", type: "FUNCTION" };

		expect(
			withRoomSettings(
				{
					mcp: [
						stored,
						{ ...stored, id: "mcp-2", fromRoom: true },
						{ ...stored, id: "mcp-3", fromWorkspace: true },
					],
				},
				SETTINGS,
			).mcp,
		).toEqual([stored]);
	});
});

describe("openRoom", () => {
	it("reads the room and binds it to a new insight", async () => {
		vi.mocked(runPixel).mockResolvedValue(
			opened([], {
				OPTIONS: '{"harnessType":"semoss","modelId":"model-1"}',
				ROOM_NAME: "Flaky tests",
			}),
		);

		await expect(openRoom("room-1")).resolves.toEqual({
			roomId: "room-1",
			insightId: "insight-1",
			name: "Flaky tests",
			options: { harnessType: "semoss", modelId: "model-1" },
			messages: [],
		});
		expect(runPixel).toHaveBeenCalledExactlyOnceWith(
			'GetPlaygroundMessages(roomId=["room-1"]); GetRoomOptions(roomId="room-1"); SetRoomForInsight(roomId="room-1");',
			"new",
		);
	});

	it("reads options the backend returns as a map", async () => {
		vi.mocked(runPixel).mockResolvedValue(
			opened([], { OPTIONS: { harnessType: "semoss" } }),
		);

		const room = await openRoom("room-1");

		expect(room.options).toEqual({ harnessType: "semoss" });
		expect(room.name).toBeUndefined();
	});

	it("reads a blank name as no name", async () => {
		vi.mocked(runPixel).mockResolvedValue(
			opened([], { OPTIONS: "{}", ROOM_NAME: "   " }),
		);

		const room = await openRoom("room-1");

		expect(room.name).toBeUndefined();
	});

	it.each([
		{ name: "an empty map", row: {} },
		{
			name: "a row without options",
			row: { OPTIONS: null, ROOM_NAME: "" },
		},
		{ name: "nothing", row: null },
	])("reads $name as a room with no options", async ({ row }) => {
		vi.mocked(runPixel).mockResolvedValue(opened([], row));

		await expect(openRoom("room-1")).resolves.toMatchObject({
			options: {},
		});
	});

	it("puts the messages oldest first, whichever way their times are written", async () => {
		vi.mocked(runPixel).mockResolvedValue(
			opened(
				[
					{
						messageId: "c",
						io: "OUTPUT",
						dateCreated: "2026-09-20 10:00:03",
					},
					{
						messageId: "a",
						io: "INPUT",
						dateCreated: "2026-09-20T10:00:01",
					},
					{
						messageId: "b",
						io: "OUTPUT",
						dateCreated: "2026-09-20 10:00:02",
					},
				],
				{},
			),
		);

		const room = await openRoom("room-1");

		expect(room.messages.map((message) => message.messageId)).toEqual([
			"a",
			"b",
			"c",
		]);
	});

	it("keeps the returned order for messages it cannot tell apart", async () => {
		vi.mocked(runPixel).mockResolvedValue(
			opened(
				[
					{
						messageId: "b",
						io: "OUTPUT",
						dateCreated: "2026-09-20 10:00:02",
					},
					{ messageId: "untimed-1", io: "INPUT" },
					{
						messageId: "untimed-2",
						io: "INPUT",
						dateCreated: "yesterday",
					},
					{
						messageId: "a-1",
						io: "INPUT",
						dateCreated: "2026-09-20 10:00:01",
					},
					{
						messageId: "a-2",
						io: "OUTPUT",
						dateCreated: "2026-09-20 10:00:01",
					},
				],
				{},
			),
		);

		const room = await openRoom("room-1");

		expect(room.messages.map((message) => message.messageId)).toEqual([
			"untimed-1",
			"untimed-2",
			"a-1",
			"a-2",
			"b",
		]);
	});

	it("reads a room without messages as having none", async () => {
		vi.mocked(runPixel).mockResolvedValue(opened(null, {}));

		await expect(openRoom("room-1")).resolves.toMatchObject({
			messages: [],
		});
	});

	it.each([
		{
			name: "options that are not JSON",
			row: { OPTIONS: "{harnessType:" },
			error: "GetRoomOptions returned options that are not JSON",
		},
		{
			name: "options that are a list",
			row: { OPTIONS: "[1, 2]" },
			error: "GetRoomOptions returned options that are not a map",
		},
		{
			name: "options that are a number",
			row: { OPTIONS: 42 },
			error: "GetRoomOptions returned options that are not a map",
		},
	])(
		"refuses $name, rather than erase them on the next save",
		async ({ row, error }) => {
			vi.mocked(runPixel).mockResolvedValue(opened([], row));

			await expect(openRoom("room-1")).rejects.toThrow(error);
		},
	);

	it("fails with the backend's error", async () => {
		vi.mocked(runPixel).mockResolvedValue(
			response(["Room not found", {}, true], {
				errors: ["Room not found"],
			}),
		);

		await expect(openRoom("room-1")).rejects.toThrow("Room not found");
	});

	it("fails without an insight to run in", async () => {
		vi.mocked(runPixel).mockResolvedValue(
			response([[], {}, true], { insightId: "" }),
		);

		await expect(openRoom("room-1")).rejects.toThrow(
			"Opening the room did not return an insight ID",
		);
	});
});

describe("createRoom", () => {
	it("creates the room in a new insight, binds it there, and saves the settings", async () => {
		vi.mocked(runPixel)
			.mockResolvedValueOnce(
				response([{ roomId: "room-1" }], { insightId: "insight-9" }),
			)
			.mockResolvedValueOnce(
				response([true, true], { insightId: "insight-9" }),
			);

		await expect(createRoom(SETTINGS)).resolves.toEqual({
			roomId: "room-1",
			insightId: "insight-9",
		});
		expect(runPixel).toHaveBeenCalledTimes(2);
		expect(runPixel).toHaveBeenNthCalledWith(
			1,
			"CreatePlaygroundRoom();",
			"new",
		);
		expect(runPixel).toHaveBeenNthCalledWith(
			2,
			`SetRoomForInsight(roomId="room-1"); UpdateRoomOptions(roomId="room-1", roomOptions=[${JSON.stringify(withRoomSettings({}, SETTINGS))}]);`,
			"insight-9",
		);
	});

	it("fails without a room ID, before saving anything", async () => {
		vi.mocked(runPixel).mockResolvedValue(response([{}]));

		await expect(createRoom(SETTINGS)).rejects.toThrow(
			"CreatePlaygroundRoom did not return a room ID",
		);
		expect(runPixel).toHaveBeenCalledTimes(1);
	});

	it("fails without an insight to bind the room to", async () => {
		vi.mocked(runPixel).mockResolvedValue(
			response([{ roomId: "room-1" }], { insightId: "" }),
		);

		await expect(createRoom(SETTINGS)).rejects.toThrow(
			"CreatePlaygroundRoom did not return an insight ID",
		);
		expect(runPixel).toHaveBeenCalledTimes(1);
	});

	it("fails when the settings cannot be saved", async () => {
		vi.mocked(runPixel)
			.mockResolvedValueOnce(response([{ roomId: "room-1" }]))
			.mockResolvedValueOnce(
				response(["Not allowed", true], { errors: ["Not allowed"] }),
			);

		await expect(createRoom(SETTINGS)).rejects.toThrow("Not allowed");
	});
});

describe("getRoomOptions", () => {
	it("reads the room's options in its insight", async () => {
		vi.mocked(runPixel).mockResolvedValue(
			response([
				{ OPTIONS: '{"modelId":"model-1"}', ROOM_NAME: "Flaky tests" },
			]),
		);

		await expect(getRoomOptions("insight-1", "room-1")).resolves.toEqual({
			modelId: "model-1",
		});
		expect(runPixel).toHaveBeenCalledExactlyOnceWith(
			'GetRoomOptions(roomId="room-1");',
			"insight-1",
		);
	});
});

describe("updateRoomOptions", () => {
	it("replaces the room's options in its insight", async () => {
		vi.mocked(runPixel).mockResolvedValue(response([true]));

		await updateRoomOptions("insight-1", "room-1", { modelId: "model-1" });

		expect(runPixel).toHaveBeenCalledExactlyOnceWith(
			'UpdateRoomOptions(roomId="room-1", roomOptions=[{"modelId":"model-1"}]);',
			"insight-1",
		);
	});

	it("fails with the backend's error", async () => {
		vi.mocked(runPixel).mockResolvedValue(
			response(["Not allowed"], { errors: ["Not allowed"] }),
		);

		await expect(
			updateRoomOptions("insight-1", "room-1", { modelId: "model-1" }),
		).rejects.toThrow("Not allowed");
	});
});
