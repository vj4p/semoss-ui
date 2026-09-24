import type { RoomHistoryMessage, RoomSettings } from "@semoss/agent-core";
import { runPixel } from "@semoss/sdk/react";

/** MCP server reference kept on a room's options. */
export type RoomMcpEntry = {
	/** Engine id of the MCP server. */
	id: string;
	/** Display name of the MCP server. */
	name: string;
	/** MCP server type. */
	type: string;
	/**
	 * Set by GetRoomOptions on the room's own toolbox, which it reads from the
	 * room folder. Reported, never stored.
	 */
	fromRoom?: boolean;
	/** Set by the harness on an agent's MCP servers. Reported, never stored. */
	fromWorkspace?: boolean;
	[key: string]: unknown;
};

/**
 * Free-form options map persisted for a room via UpdateRoomOptions.
 *
 * The console reads and writes only the harness and the model. Everything
 * else belongs to whichever UI set it (the harness keeps instructions, MCP
 * servers and prompts here) and is written back untouched.
 */
export type RoomOptions = {
	/** System prompt applied to the room's agent runs. */
	instructions?: string;
	/** MCP servers exposed to the room's agent runs. */
	mcp?: RoomMcpEntry[];
	/** Suggested prompts surfaced in the harness. */
	predefinedPrompts?: unknown[];
	/** Engine id of the model persisted for the room. */
	modelId?: string;
	/** Agent harness persisted for the room. */
	harnessType?: string;
	[key: string]: unknown;
};

/** A persisted message, as GetPlaygroundMessages returns it. */
type PlaygroundMessage = RoomHistoryMessage & {
	/** When the message was persisted ("YYYY-MM-DD HH:MM:SS" or ISO). */
	dateCreated?: string;
};

/** A room the console has opened. */
export type OpenedRoom = {
	/** Durable id of the room. */
	roomId: string;
	/** Insight the room is bound to, which its runs execute against. */
	insightId: string;
	/** Display name of the room, when it has one. */
	name?: string;
	/** The room's persisted options. */
	options: RoomOptions;
	/** The room's persisted messages, oldest first. */
	messages: RoomHistoryMessage[];
};

/**
 * What a new room is saved with, besides the harness and the model: the
 * harness reads these as arrays and strings, so a room without them breaks
 * the harness when the same room is opened there.
 */
const NEW_ROOM_OPTIONS: RoomOptions = {
	instructions: "",
	mcp: [],
	predefinedPrompts: [],
};

/**
 * Throw when a pixel response contains an operation error. No-op when the
 * error list is empty.
 *
 * @name assertPixelSuccess
 * @param errors - Operation errors collected from a runPixel response.
 */
const assertPixelSuccess = (errors: string[]): void => {
	if (errors.length > 0) {
		throw new Error(errors.join(""));
	}
};

/**
 * Narrow an unknown value to a plain object.
 *
 * @name isRecord
 * @param value - Any value.
 * @return True when the value is a non-null, non-array object.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Read GetRoomOptions output: a row of `OPTIONS` and `ROOM_NAME`, or an empty
 * map when the user has no such room.
 *
 * An `OPTIONS` value that is present but unreadable throws rather than reading
 * as empty. UpdateRoomOptions replaces the whole map, so treating it as empty
 * would erase the room's instructions and MCP servers on the next save.
 *
 * @name readRoomRow
 * @param output - Raw GetRoomOptions output.
 * @return The room's name, when it has one, and its options.
 */
const readRoomRow = (
	output: unknown,
): { name?: string; options: RoomOptions } => {
	if (!isRecord(output)) {
		return { options: {} };
	}

	const name =
		typeof output.ROOM_NAME === "string" && output.ROOM_NAME.trim() !== ""
			? output.ROOM_NAME
			: undefined;

	let options = output.OPTIONS;
	if (typeof options === "string") {
		try {
			options = JSON.parse(options);
		} catch {
			throw new Error(
				"GetRoomOptions returned options that are not JSON",
			);
		}
	}
	if (options === undefined || options === null) {
		return { name, options: {} };
	}
	if (!isRecord(options)) {
		throw new Error("GetRoomOptions returned options that are not a map");
	}
	return { name, options: options as RoomOptions };
};

/**
 * Parse a persisted message timestamp ("YYYY-MM-DD HH:MM:SS" or ISO) into
 * epoch milliseconds for ordering.
 *
 * @name parseMessageTime
 * @param value - Raw timestamp off a persisted message.
 * @return Epoch milliseconds, or 0 when the timestamp is missing/unparseable.
 */
const parseMessageTime = (value?: string): number => {
	if (!value) {
		return 0;
	}
	const normalized = value.includes("T") ? value : value.replace(" ", "T");
	const time = Date.parse(normalized);
	return Number.isNaN(time) ? 0 : time;
};

/**
 * Put a room's messages oldest first. The backend does not accept a sort
 * argument, and which branch of an edited prompt is shown depends on the
 * order, so it is applied here (stable, so equal or unparseable timestamps
 * keep their returned order).
 *
 * @name sortMessages
 * @param output - Raw GetPlaygroundMessages output.
 * @return The messages, oldest first, or an empty array when there are none.
 */
const sortMessages = (output: unknown): RoomHistoryMessage[] => {
	if (!Array.isArray(output)) {
		return [];
	}
	return [...(output as PlaygroundMessage[])].sort(
		(a, b) =>
			parseMessageTime(a.dateCreated) - parseMessageTime(b.dateCreated),
	);
};

/**
 * Merge the console's settings into a room's options, ready to write back.
 *
 * MCP entries the backend or the harness only report (the room's toolbox, an
 * agent's servers) are dropped, as the harness drops them: storing one would
 * make it outlive its source.
 *
 * @name withRoomSettings
 * @param options - The room's current options.
 * @param settings - The harness and the model to save.
 * @return The options to pass to UpdateRoomOptions.
 */
export const withRoomSettings = (
	options: RoomOptions,
	settings: RoomSettings,
): RoomOptions => ({
	...NEW_ROOM_OPTIONS,
	...options,
	mcp: (options.mcp ?? []).filter(
		(mcp) => !mcp?.fromRoom && !mcp?.fromWorkspace,
	),
	harnessType: settings.harness,
	modelId: settings.modelId,
});

/**
 * Create a playground room in a new insight, bind it to that insight, and save
 * it with the console's settings.
 *
 * A playground room, so the harness lists it among its rooms and can open it.
 *
 * @name createRoom
 * @param settings - The harness and the model the room is saved with.
 * @return The id of the new room and of the insight it is bound to.
 */
export const createRoom = async (
	settings: RoomSettings,
): Promise<{ roomId: string; insightId: string }> => {
	const created = await runPixel<[{ roomId: string }]>(
		"CreatePlaygroundRoom();",
		"new",
	);
	assertPixelSuccess(created.errors);

	const roomId = created.pixelReturn[0]?.output?.roomId;
	if (!roomId) {
		throw new Error("CreatePlaygroundRoom did not return a room ID");
	}
	const { insightId } = created;
	if (!insightId) {
		throw new Error("CreatePlaygroundRoom did not return an insight ID");
	}

	// CreatePlaygroundRoom does not bind the room to its insight.
	const saved = await runPixel<[boolean, boolean]>(
		`SetRoomForInsight(roomId=${JSON.stringify(roomId)}); UpdateRoomOptions(roomId=${JSON.stringify(roomId)}, roomOptions=[${JSON.stringify(withRoomSettings({}, settings))}]);`,
		insightId,
	);
	assertPixelSuccess(saved.errors);

	return { roomId, insightId };
};

/**
 * Open a room in a new insight: read its messages and options, and bind it to
 * that insight so its runs execute there.
 *
 * @name openRoom
 * @param roomId - Room to open.
 * @return The room, with the insight it is now bound to.
 */
export const openRoom = async (roomId: string): Promise<OpenedRoom> => {
	const response = await runPixel<[unknown, unknown, boolean]>(
		`GetPlaygroundMessages(roomId=${JSON.stringify([roomId])}); GetRoomOptions(roomId=${JSON.stringify(roomId)}); SetRoomForInsight(roomId=${JSON.stringify(roomId)});`,
		"new",
	);
	assertPixelSuccess(response.errors);

	const { insightId } = response;
	if (!insightId) {
		throw new Error("Opening the room did not return an insight ID");
	}

	return {
		roomId,
		insightId,
		...readRoomRow(response.pixelReturn[1]?.output),
		messages: sortMessages(response.pixelReturn[0]?.output),
	};
};

/**
 * Read the persisted options map for a room.
 *
 * @name getRoomOptions
 * @param insightId - Insight the pixel executes against.
 * @param roomId - Room whose options to read.
 * @return The room's options; empty when none are persisted.
 */
export const getRoomOptions = async (
	insightId: string,
	roomId: string,
): Promise<RoomOptions> => {
	const response = await runPixel<[unknown]>(
		`GetRoomOptions(roomId=${JSON.stringify(roomId)});`,
		insightId,
	);
	assertPixelSuccess(response.errors);

	return readRoomRow(response.pixelReturn[0]?.output).options;
};

/**
 * Persist the options map for a room. Replaces the stored map.
 *
 * @name updateRoomOptions
 * @param insightId - Insight the pixel executes against.
 * @param roomId - Room whose options to persist.
 * @param options - Options map to store, from {@link withRoomSettings}.
 * @return Resolves when the options are persisted.
 */
export const updateRoomOptions = async (
	insightId: string,
	roomId: string,
	options: RoomOptions,
): Promise<void> => {
	const response = await runPixel<[boolean]>(
		`UpdateRoomOptions(roomId=${JSON.stringify(roomId)}, roomOptions=[${JSON.stringify(options)}]);`,
		insightId,
	);
	assertPixelSuccess(response.errors);
};
