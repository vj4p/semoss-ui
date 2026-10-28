import { useCallback } from "react";
import { useTranslation } from "@semoss/i18n";
import { cn, Muted, P, Small } from "@semoss/ui/next";
import { getRoomRuns } from "@/api/room-data";
import { useOverlayQuery } from "@/hooks/use-overlay-query";
import { agoOf } from "@/utility/server-time";
import { OverlayContainer } from "./overlay-container";
import { OverlayEmpty } from "./overlay-empty";
import { OverlayError } from "./overlay-error";
import { OverlayLoading } from "./overlay-loading";
import { describeRunStatus } from "./run-status";

export interface RunsOverlayProps {
	open: boolean;
	onDismiss: () => void;
	/** The room to list the runs of. Absent until the session has a room. */
	roomId?: string;
	/** The insight the room is bound to. */
	insightId?: string;
}

/** The longest prompt a row shows before it is cut. */
const PROMPT_PREVIEW = 100;

/**
 * The `:runs` overlay: the room's runs, newest first, with when each started,
 * how it ended and how long it took.
 *
 * Read from the platform rather than from this session's memory, so a room
 * that was reopened still shows what ran in it before.
 *
 * @name RunsOverlay
 * @param props.open - Whether the overlay is showing.
 * @param props.onDismiss - Called to close it.
 * @param props.roomId - The room, when there is one.
 * @param props.insightId - The room's insight.
 */
export const RunsOverlay = ({
	open,
	onDismiss,
	roomId,
	insightId,
}: RunsOverlayProps) => {
	const { t } = useTranslation("code");
	const load = useCallback(
		() => (roomId ? getRoomRuns(roomId, insightId) : Promise.resolve([])),
		[roomId, insightId],
	);
	const { state, reload } = useOverlayQuery(open, load);

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":runs">
			{state.status === "loading" ? (
				<OverlayLoading />
			) : state.status === "error" ? (
				<OverlayError error={state.error} onRetry={reload} />
			) : state.data.length === 0 ? (
				<OverlayEmpty
					title={t("overlay.runs.empty")}
					description={t("overlay.runs.emptyHint")}
				/>
			) : (
				<div className="flex flex-col gap-4 font-mono">
					<Muted>
						{t("overlay.runs.heading", {
							count: state.data.length,
						})}
					</Muted>
					<ul className="flex flex-col gap-2">
						{state.data.map((run) => {
							const status = describeRunStatus(run.status);
							const ago = run.startedAt
								? agoOf(run.startedAt)
								: undefined;
							return (
								<li
									key={run.id}
									className="flex flex-col gap-1 rounded-md border p-3"
								>
									<div className="flex items-center justify-between gap-2">
										<Muted>
											{ago
												? t(`overlay.ago.${ago.unit}`, {
														count: ago.count,
													})
												: t("overlay.unknownTime")}
										</Muted>
										<Small
											className={cn(
												"text-xs",
												status.className,
											)}
										>
											{status.label}
										</Small>
									</div>
									<P className="break-words text-sm">
										{run.prompt
											? run.prompt.length > PROMPT_PREVIEW
												? `${run.prompt.slice(0, PROMPT_PREVIEW)}…`
												: run.prompt
											: t("overlay.runs.emptyPrompt")}
									</P>
									{run.durationMs !== undefined ? (
										<Muted className="text-xs">
											{t("overlay.runs.seconds", {
												seconds: (
													run.durationMs / 1000
												).toFixed(1),
											})}
										</Muted>
									) : null}
								</li>
							);
						})}
					</ul>
				</div>
			)}
		</OverlayContainer>
	);
};
