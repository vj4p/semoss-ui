import { useCallback, useEffect, useState } from "react";
import { type CapabilityPack, readCapabilityPacks } from "@semoss/agent-core";
import { useInsight } from "@semoss/sdk/react";

/**
 * Every capability pack visible to the caller, with live tool/ask counts.
 *
 * Shared by the Capabilities panel and the composer's reach strip so the two
 * batched-pixel readers (`GetMCPTools`, the SKILL.md description) exist exactly
 * once — they now live in `@semoss/agent-core`, since a console host needs the
 * same reads with no React in sight. What is left here is the React part and
 * only the React part: the insight, the loading flag, and where errors go.
 */
export const useRoomPacks = () => {
	const insight = useInsight();
	const [packs, setPacks] = useState<CapabilityPack[]>([]);
	const [loading, setLoading] = useState(false);

	const reload = useCallback(async () => {
		setLoading(true);
		try {
			setPacks(await readCapabilityPacks(insight, console.error));
		} finally {
			setLoading(false);
		}
	}, [insight]);

	useEffect(() => {
		void reload();
	}, [reload]);

	return { packs, loading, reload };
};
