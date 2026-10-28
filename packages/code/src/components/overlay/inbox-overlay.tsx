import { useCallback } from "react";
import { Link } from "react-router";
import { useTranslation } from "@semoss/i18n";
import { Button, Muted, P } from "@semoss/ui/next";
import { getPendingActions } from "@/api/room-data";
import { useOverlayQuery } from "@/hooks/use-overlay-query";
import { agoOf } from "@/utility/server-time";
import { OverlayContainer } from "./overlay-container";
import { OverlayEmpty } from "./overlay-empty";
import { OverlayError } from "./overlay-error";
import { OverlayLoading } from "./overlay-loading";

export interface InboxOverlayProps {
	open: boolean;
	onDismiss: () => void;
	/** The room's insight, when there is a room. The list itself is not about one room. */
	insightId?: string;
}

/** How much of a room's id a row shows; enough to tell rooms apart. */
const SHORT_ID = 8;

/**
 * The `:inbox` overlay: the agent actions waiting on you, across all your rooms.
 *
 * An agent that wants to do something a person must approve waits in its own
 * room, so a console on a different room would never hear of it. The list is
 * the platform's own, scoped to the signed-in user. Deciding an action happens
 * in its room, so each row opens that room.
 *
 * @name InboxOverlay
 * @param props.open - Whether the overlay is showing.
 * @param props.onDismiss - Called to close it.
 * @param props.insightId - The room's insight, when there is one.
 */
export const InboxOverlay = ({
	open,
	onDismiss,
	insightId,
}: InboxOverlayProps) => {
	const { t } = useTranslation("code");
	const load = useCallback(() => getPendingActions(insightId), [insightId]);
	const { state, reload } = useOverlayQuery(open, load);

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":inbox">
			{state.status === "loading" ? (
				<OverlayLoading />
			) : state.status === "error" ? (
				<OverlayError error={state.error} onRetry={reload} />
			) : state.data.length === 0 ? (
				<OverlayEmpty
					title={t("overlay.inbox.empty")}
					description={t("overlay.inbox.emptyHint")}
				/>
			) : (
				<div className="flex flex-col gap-4 font-mono">
					<Muted>
						{t("overlay.inbox.heading", {
							count: state.data.length,
						})}
					</Muted>
					<ul className="flex flex-col gap-2">
						{state.data.map((action) => {
							const ago = action.createdAt
								? agoOf(action.createdAt)
								: undefined;
							return (
								<li
									key={action.id}
									className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="min-w-0">
										<P className="break-words text-sm">
											{t("overlay.inbox.approve", {
												tool:
													action.tool ||
													t("overlay.inbox.anyTool"),
											})}
										</P>
										<Muted className="text-xs">
											{ago
												? t(`overlay.ago.${ago.unit}`, {
														count: ago.count,
													})
												: t("overlay.unknownTime")}
											{" · "}
											{t("overlay.inbox.room", {
												id: action.roomId.slice(
													0,
													SHORT_ID,
												),
											})}
										</Muted>
									</div>
									<Button variant="outline" size="sm" asChild>
										<Link
											to={`/room/${encodeURIComponent(action.roomId)}`}
											onClick={onDismiss}
										>
											{t("overlay.inbox.openRoom")}
										</Link>
									</Button>
								</li>
							);
						})}
					</ul>
				</div>
			)}
		</OverlayContainer>
	);
};
