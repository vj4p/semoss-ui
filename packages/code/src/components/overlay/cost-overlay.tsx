import { useCallback } from "react";
import { useTranslation } from "@semoss/i18n";
import type { CostSummary } from "@/api/cost-summary";
import { getRoomCost } from "@/api/room-data";
import { useOverlayQuery } from "@/hooks/use-overlay-query";
import { CostBody } from "./cost-body";
import { OverlayContainer } from "./overlay-container";
import { OverlayEmpty } from "./overlay-empty";
import { OverlayError } from "./overlay-error";
import { OverlayLoading } from "./overlay-loading";

export interface CostOverlayProps {
	open: boolean;
	onDismiss: () => void;
	/** The room to total. Absent until the session has a room. */
	roomId?: string;
	/** The insight the room is bound to. */
	insightId?: string;
}

/**
 * The `:cost` overlay: what the room has used and what it cost, per model.
 *
 * A model the platform has no price for says so ("No price") instead of
 * counting as zero, and a total that leaves such a model out is marked as a
 * minimum. See `summarizeCost`.
 *
 * @name CostOverlay
 * @param props.open - Whether the overlay is showing.
 * @param props.onDismiss - Called to close it.
 * @param props.roomId - The room, when there is one.
 * @param props.insightId - The room's insight.
 */
export const CostOverlay = ({
	open,
	onDismiss,
	roomId,
	insightId,
}: CostOverlayProps) => {
	const { t, i18n } = useTranslation("code");
	const locale = i18n.language;
	const load = useCallback(
		(): Promise<CostSummary | null> =>
			roomId ? getRoomCost(roomId, insightId) : Promise.resolve(null),
		[roomId, insightId],
	);
	const { state, reload } = useOverlayQuery(open, load);

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":cost">
			{state.status === "loading" ? (
				<OverlayLoading />
			) : state.status === "error" ? (
				<OverlayError error={state.error} onRetry={reload} />
			) : state.data === null || state.data.totalCalls === 0 ? (
				<OverlayEmpty
					title={t("overlay.cost.empty")}
					description={t("overlay.cost.emptyHint")}
				/>
			) : (
				<CostBody summary={state.data} locale={locale} />
			)}
		</OverlayContainer>
	);
};
