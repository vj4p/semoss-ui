import { useCallback, useEffect, useState } from "react";

/** Where an overlay's read is: running, answered, or failed. */
export type OverlayQueryState<T> =
	| { status: "loading" }
	| { status: "ready"; data: T }
	| { status: "error"; error: Error };

/** What `useOverlayQuery` hands the overlay. */
export interface OverlayQuery<T> {
	state: OverlayQueryState<T>;
	/** Run the read again, for a Retry button. */
	reload: () => void;
}

/**
 * Read something when an overlay opens, and again on request.
 *
 * Reads only while `enabled`, so a closed overlay costs nothing, and a read
 * that was started for an earlier open, room or retry is dropped when its
 * answer arrives late rather than overwriting the newer one.
 *
 * `load` is an effect dependency: pass one made with `useCallback` over the
 * values it reads, or it will run again on every render.
 *
 * @name useOverlayQuery
 * @param enabled - Whether to read; false leaves the last state alone.
 * @param load - The read. Rejections become the `error` state.
 * @return The state and a `reload`.
 */
export const useOverlayQuery = <T>(
	enabled: boolean,
	load: () => Promise<T>,
): OverlayQuery<T> => {
	const [state, setState] = useState<OverlayQueryState<T>>({
		status: "loading",
	});
	const [attempt, setAttempt] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is not read here; changing it is how reload() runs the effect again
	useEffect(() => {
		if (!enabled) {
			return;
		}
		let stale = false;
		setState({ status: "loading" });
		load().then(
			(data) => {
				if (!stale) {
					setState({ status: "ready", data });
				}
			},
			(error: unknown) => {
				if (!stale) {
					setState({
						status: "error",
						error:
							error instanceof Error
								? error
								: new Error(String(error)),
					});
				}
			},
		);
		return () => {
			stale = true;
		};
	}, [enabled, load, attempt]);

	const reload = useCallback(() => setAttempt((count) => count + 1), []);
	return { state, reload };
};
