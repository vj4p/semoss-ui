import { isRecord } from "@/utility/is-record";
import { parseServerTime } from "@/utility/server-time";

/** One agent action waiting on the user, as the `:inbox` overlay lists it. */
export interface PendingAction {
	id: string;
	roomId: string;
	/** The tool's name, or empty when the platform sent none. */
	tool: string;
	createdAt?: Date;
}

/**
 * The actions from `GetPendingAgentActions`, in the order it returns them
 * (newest first). Rows without an id and a room are dropped.
 *
 * @name parsePendingActions
 * @param output - The reactor's output.
 * @return The actions.
 */
export const parsePendingActions = (output: unknown): PendingAction[] => {
	if (!Array.isArray(output)) {
		return [];
	}
	return output.flatMap((row): PendingAction[] => {
		if (
			!isRecord(row) ||
			typeof row.actionId !== "string" ||
			typeof row.roomId !== "string"
		) {
			return [];
		}
		return [
			{
				id: row.actionId,
				roomId: row.roomId,
				tool: typeof row.toolName === "string" ? row.toolName : "",
				createdAt: parseServerTime(row.dateCreated),
			},
		];
	});
};
