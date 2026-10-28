import { parseServerTime } from "./server-time";

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
 */
export const parseRoomRuns = (output: unknown): RoomRun[] => {
	if (!Array.isArray(output)) {
		return [];
	}
	const runs = output.flatMap((row): RoomRun[] => {
		if (typeof row !== "object" || row === null) {
			return [];
		}
		const run = row as Record<string, unknown>;
		if (typeof run.runId !== "string") {
			return [];
		}
		const startedAt =
			parseServerTime(run.startedAt) ?? parseServerTime(run.dateCreated);
		const completedAt = parseServerTime(run.completedAt);
		return [
			{
				id: run.runId,
				prompt: typeof run.input === "string" ? run.input : "",
				status: typeof run.status === "string" ? run.status : "UNKNOWN",
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
