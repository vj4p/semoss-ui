import { useEffect, useState } from "react";
import type { CostSummary } from "@/api/cost-summary";
import { getRoomCost } from "@/api/room-data";

/** The usage read for one room, kept with the room so another room never shows it. */
interface RoomCost {
	roomId: string;
	summary: CostSummary | null;
}

/**
 * What the room has used, for the status bar.
 *
 * Reads when the room opens and again each time the console settles after a
 * run, which is when the usage log has something new. While a run is going the
 * last figure stays, rather than a cost that is out of date by the minute. A
 * failed read leaves no figure: the status bar shows nothing rather than a
 * wrong number, and `:cost` is where a failure is explained.
 *
 * @name useRoomCost
 * @param props.roomId - The room, when there is one.
 * @param props.insightId - The insight the room is bound to.
 * @param props.settled - True when no run is going.
 * @return The summary for this room, or undefined when it is not known.
 */
export const useRoomCost = ({
	roomId,
	insightId,
	settled,
}: {
	roomId?: string;
	insightId?: string;
	settled: boolean;
}): CostSummary | null | undefined => {
	const [cost, setCost] = useState<RoomCost | undefined>();

	useEffect(() => {
		if (!roomId || !settled) {
			return;
		}
		let stale = false;
		getRoomCost(roomId, insightId).then(
			(summary) => {
				if (!stale) {
					setCost({ roomId, summary });
				}
			},
			() => {
				if (!stale) {
					setCost(undefined);
				}
			},
		);
		return () => {
			stale = true;
		};
	}, [roomId, insightId, settled]);

	return cost !== undefined && cost.roomId === roomId
		? cost.summary
		: undefined;
};
