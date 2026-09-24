import { useEffect, useState } from "react";

/** How often the count moves on. */
const TICK_MS = 1_000;

/**
 * Whole seconds since `startedAt`, counting while it is set.
 *
 * @name useElapsedSeconds
 * @param startedAt - When the run started, in epoch milliseconds, or
 * undefined when none is going.
 * @return The seconds since then, or undefined when `startedAt` is.
 */
export const useElapsedSeconds = (startedAt?: number): number | undefined => {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (startedAt === undefined) {
			return;
		}
		setNow(Date.now());
		const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
		return () => window.clearInterval(timer);
	}, [startedAt]);

	return startedAt === undefined
		? undefined
		: Math.max(0, Math.floor((now - startedAt) / 1_000));
};
