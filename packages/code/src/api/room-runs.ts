import { isRecord } from "@/utility/is-record";
import { parseServerTime } from "@/utility/server-time";

/** One of the room's runs, as the `:runs` overlay lists it. */
export interface RoomRun {
	id: string;
	prompt: string;
	/** The backend status as reported, shown through `describeRunStatus`. */
	status: string;
	startedAt?: Date;
	/** Absent while the run is still going. */
	durationMs?: number;
}

/**
 * The room's runs from `GetAgentRunsForRoom`, newest first.
 *
 * The reactor returns them oldest first, for replaying a conversation. A run
 * has a duration only once it has both ends: a running one has no `completedAt`,
 * and showing a made-up duration for it would be worse than showing none.
 *
 * @name parseRoomRuns
 * @param output - The reactor's output.
 * @return The runs.
 */
export const parseRoomRuns = (output: unknown): RoomRun[] => {
	if (!Array.isArray(output)) {
		return [];
	}
	const runs = output.flatMap((row): RoomRun[] => {
		if (!isRecord(row) || typeof row.runId !== "string") {
			return [];
		}
		const startedAt =
			parseServerTime(row.startedAt) ?? parseServerTime(row.dateCreated);
		const completedAt = parseServerTime(row.completedAt);
		return [
			{
				id: row.runId,
				prompt: typeof row.input === "string" ? row.input : "",
				status: typeof row.status === "string" ? row.status : "UNKNOWN",
				startedAt,
				durationMs:
					startedAt && completedAt
						? Math.max(
								0,
								completedAt.getTime() - startedAt.getTime(),
							)
						: undefined,
			},
		];
	});
	return runs.reverse();
};
