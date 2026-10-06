import { getOrCreateAgent, type SessionBackend } from "@semoss/agent-core";
import { AgentStore } from "@semoss/sdk/react";
import {
	createRoom,
	getRoomOptions,
	updateRoomOptions,
	withRoomSettings,
} from "@/api";

/**
 * The session's port to the server.
 *
 * Every call runs in the insight the room is bound to: the one it was opened
 * in, or, for a room the session creates, the one it was created in. A session
 * that starts without a room has no insight until its first prompt creates the
 * room, and needs none before then. A subagent's run is followed in that
 * insight too, though its room is its own.
 *
 * @name createSessionBackend
 * @param insightId - Insight the opened room is bound to, when the session
 * starts in one.
 * @param onInsightBound - Called once, synchronously before `createRoom`
 * resolves, when a session with no room creates one and so first learns its
 * insight. The host state (`useConsoleSession`) has no other way to find out:
 * this insight lives only in this closure's `boundInsightId`, and the state
 * it hands the `:mcp` overlay is otherwise never updated after the session is
 * created, leaving `insightId` stuck `undefined` and MCPOverlay unable to
 * tell `:mcp` apart from "no room yet" for the rest of that session.
 * @return The backend to create the session with.
 */
export const createSessionBackend = (
	insightId?: string,
	onInsightBound?: (insightId: string) => void,
): SessionBackend => {
	let boundInsightId = insightId;

	const requireInsight = (): string => {
		if (!boundInsightId) {
			throw new Error("The room is not bound to an insight");
		}
		return boundInsightId;
	};

	return {
		createRoom: async (settings) => {
			const room = await createRoom(settings);
			boundInsightId = room.insightId;
			onInsightBound?.(room.insightId);
			return room.roomId;
		},
		updateRoom: async (roomId, settings) => {
			const insight = requireInsight();
			const options = await getRoomOptions(insight, roomId);
			await updateRoomOptions(
				insight,
				roomId,
				withRoomSettings(options, settings),
			);
		},
		// Not registered or watched here: the session does both.
		startRun: async ({ roomId, command, harness, modelId }) =>
			AgentStore.start(
				{ roomId, command, engine: modelId, harnessType: harness },
				requireInsight(),
			),
		// The run's store in the registry, so that a run this tab already
		// watches is not polled twice. Not watched here: the session does
		// that, as it does its own runs.
		followRun: ({ runId, roomId }) =>
			getOrCreateAgent(roomId, requireInsight(), runId),
	};
};
