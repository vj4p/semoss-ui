import { parseServerTime } from "./server-time";

/** One agent action waiting on the user, as the `:inbox` overlay lists it. */
export interface PendingAction {
	id: string;
	roomId: string;
	tool: string;
	createdAt?: Date;
}

/** The actions from `GetPendingAgentActions`, in the order it returns them (newest first). */
export const parsePendingActions = (output: unknown): PendingAction[] => {
	if (!Array.isArray(output)) {
		return [];
	}
	return output.flatMap((row): PendingAction[] => {
		if (typeof row !== "object" || row === null) {
			return [];
		}
		const action = row as Record<string, unknown>;
		if (
			typeof action.actionId !== "string" ||
			typeof action.roomId !== "string"
		) {
			return [];
		}
		return [
			{
				id: action.actionId,
				roomId: action.roomId,
				tool:
					typeof action.toolName === "string" && action.toolName
						? action.toolName
						: "a tool",
				createdAt: parseServerTime(action.dateCreated),
			},
		];
	});
};
