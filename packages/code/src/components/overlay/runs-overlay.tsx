import { useEffect, useState } from "react";
import type { Session } from "@semoss/agent-core";
import { runPixel } from "@semoss/sdk";
import { Spinner } from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";
import { parseRoomRuns, type RoomRun } from "./room-runs";
import { describeRunStatus } from "./run-status";
import { formatAgo } from "./server-time";

export interface RunsOverlayProps {
	open: boolean;
	onDismiss: () => void;
	session: Session | null;
}

/**
 * The `:runs` overlay — the room's runs, newest first, with when each started,
 * how it ended and how long it took.
 *
 * Read from the platform rather than from this session's memory, so a room
 * that was reopened still shows what ran in it before.
 */
export const RunsOverlay = ({ open, onDismiss, session }: RunsOverlayProps) => {
	const [loading, setLoading] = useState(true);
	const [runs, setRuns] = useState<RoomRun[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open || !session) {
			return;
		}
		const roomId = session.getState().roomId;
		if (!roomId) {
			// No room yet, so nothing has run.
			setRuns([]);
			setError(null);
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		runPixel<[unknown]>(
			`GetAgentRunsForRoom(roomId=[${JSON.stringify(roomId)}]);`,
		)
			.then((response) => {
				if (cancelled) return;
				if (response.errors.length > 0) {
					throw new Error(response.errors[0]);
				}
				setRuns(parseRoomRuns(response.pixelReturn[0]?.output));
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				setRuns([]);
				setError(
					err instanceof Error
						? err.message
						: "Could not load the runs",
				);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open, session]);

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":runs">
			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Spinner />
				</div>
			) : error ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono text-destructive text-sm">
						{error}
					</p>
					<p className="text-muted-foreground text-xs">
						Unable to load this room's runs
					</p>
				</div>
			) : runs.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono text-muted-foreground text-sm">
						No runs yet
					</p>
					<p className="text-muted-foreground text-xs">
						Send a prompt to start your first run
					</p>
				</div>
			) : (
				<div className="space-y-1">
					<p className="mb-4 font-mono text-muted-foreground text-sm">
						Run history ({runs.length} total)
					</p>
					<div className="space-y-2">
						{runs.map((run) => {
							const status = describeRunStatus(run.status);
							return (
								<div
									key={run.id}
									className="flex flex-col gap-1 rounded border p-3 hover:bg-accent"
								>
									<div className="flex items-center justify-between">
										<span className="font-mono text-muted-foreground text-xs">
											{run.startedAt
												? formatAgo(run.startedAt)
												: "unknown time"}
										</span>
										<span
											className={`font-medium font-mono text-xs ${status.className}`}
										>
											{status.label}
										</span>
									</div>
									<p className="font-mono text-sm">
										{run.prompt
											? run.prompt.length > 100
												? `${run.prompt.slice(0, 100)}…`
												: run.prompt
											: "(empty prompt)"}
									</p>
									{run.durationMs !== undefined && (
										<span className="font-mono text-muted-foreground text-xs">
											{(run.durationMs / 1000).toFixed(1)}
											s
										</span>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}
		</OverlayContainer>
	);
};
