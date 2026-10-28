import { type CapabilityPack, readCapabilityPacks } from "@semoss/agent-core";
import { runPixel } from "@semoss/sdk/react";
import { type CostSummary, summarizeCost } from "./cost-summary";
import { type PendingAction, parsePendingActions } from "./pending-actions";
import {
	browseRoomFolderPixel,
	parseRoomFolderListing,
	type RoomFileEntry,
} from "./room-files";
import { parseRoomRuns, type RoomRun } from "./room-runs";

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
 * Run one pixel and return the first operation's output, after checking it
 * did not fail.
 *
 * @name readOutput
 * @param pixel - The expression to run.
 * @param insightId - The insight to run it in; a new one when absent.
 * @return The output, still `unknown` for the caller's parser to check.
 */
const readOutput = async (
	pixel: string,
	insightId?: string,
): Promise<unknown> => {
	const response = await runPixel<[unknown]>(pixel, insightId);
	assertPixelSuccess(response.errors);
	return response.pixelReturn[0]?.output;
};

/**
 * List one folder of the room's workspace.
 *
 * @name browseRoomFolder
 * @param insightId - The insight the room is bound to.
 * @param folder - The folder to list.
 * @return The folder's entries, folders first as the reactor sorts them.
 */
export const browseRoomFolder = async (
	insightId: string,
	folder: string,
): Promise<RoomFileEntry[]> =>
	parseRoomFolderListing(
		await readOutput(browseRoomFolderPixel(folder), insightId),
	);

/**
 * The room's agent runs, newest first, read from the platform so a reopened
 * room keeps what ran in it before.
 *
 * @name getRoomRuns
 * @param roomId - The room.
 * @param insightId - The insight the room is bound to.
 * @return The runs.
 */
export const getRoomRuns = async (
	roomId: string,
	insightId?: string,
): Promise<RoomRun[]> =>
	parseRoomRuns(
		await readOutput(
			`GetAgentRunsForRoom(roomId=[${JSON.stringify(roomId)}]);`,
			insightId,
		),
	);

/**
 * What the room has used and what it cost.
 *
 * @name getRoomCost
 * @param roomId - The room.
 * @param insightId - The insight the room is bound to.
 * @return The summary, or null when the platform sent no usage.
 */
export const getRoomCost = async (
	roomId: string,
	insightId?: string,
): Promise<CostSummary | null> =>
	summarizeCost(
		await readOutput(
			`GetModelCost(roomId=[${JSON.stringify(roomId)}]);`,
			insightId,
		),
	);

/**
 * The agent actions waiting on the signed-in user, across all their rooms.
 *
 * @name getPendingActions
 * @param insightId - An insight to run in, when the console has one.
 * @return The actions, newest first.
 */
export const getPendingActions = async (
	insightId?: string,
): Promise<PendingAction[]> =>
	parsePendingActions(
		await readOutput("GetPendingAgentActions();", insightId),
	);

/**
 * The capability packs the user can see.
 *
 * `readCapabilityPacks` reports a failure through a callback and returns an
 * empty list, which would read as "no packs". An empty result with a reported
 * failure is thrown here so the overlay can say it failed. A failure on one
 * pack among others is only logged: the rest are still worth showing.
 *
 * @name getCapabilityPacks
 * @param insightId - An insight to run in, when the console has one.
 * @return The packs.
 */
export const getCapabilityPacks = async (
	insightId?: string,
): Promise<CapabilityPack[]> => {
	const failures: unknown[] = [];
	// runPixel already returns the response the reader wants, with the
	// operations under pixelReturn. Wrapping it again once put the whole
	// response where the pack list should be, so no pack was ever found.
	const packs = await readCapabilityPacks(
		{ actions: { run: (pixel: string) => runPixel(pixel, insightId) } },
		(message, error) => {
			console.warn(message, error);
			failures.push(error ?? new Error(message));
		},
	);
	if (packs.length === 0 && failures.length > 0) {
		throw failures[0] instanceof Error
			? failures[0]
			: new Error("Could not read the capability packs");
	}
	return packs;
};
