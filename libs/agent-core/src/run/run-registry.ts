import type { AgentRunSnapshot, AgentRunStatusValue } from "@semoss/sdk";
import { AgentStore } from "@semoss/sdk";

/**
 * Handler bag `AgentStore.watch` takes, read off the method itself rather than
 * imported.
 *
 * `AgentWatchHandlers` is exported from its own module but the SDK barrel uses
 * an explicit named-export list that omits it, so it is not nameable from
 * `@semoss/sdk`. Deriving it structurally avoids widening the SDK's public
 * surface for a type this library only passes through, and it tracks the real
 * signature if the SDK ever changes it.
 */
export type AgentWatchHandlers = Parameters<AgentStore["watch"]>[0];
export type AgentWatchOptions = Parameters<AgentStore["watch"]>[1];

/**
 * Live AgentStores keyed by runId, so a decision made from the tool UI (which
 * only has the pendingAction, not the run's watcher) can poke the SAME
 * instance that's polling it, and reconnectAgentRun never mounts a second,
 * destructive poller on a run runAgentMessage (or an earlier reconnect) is
 * already watching.
 *
 * Module-level on purpose: the invariant is "one watcher per run per tab", so
 * there must be exactly one map per bundle. Anything that hands out an
 * AgentStore has to go through here, or the destructive drain silently splits
 * a run's events between two pollers.
 */
const agentsByRunId = new Map<string, AgentStore>();

/**
 * Get the live AgentStore for a run if one is already being watched,
 * otherwise create (and register) a fresh, not-yet-watched one.
 */
export const getOrCreateAgent = (
	roomId: string,
	insightId: string,
	runId: string,
): AgentStore => {
	const existing = agentsByRunId.get(runId);
	if (existing) {
		return existing;
	}
	const agent = new AgentStore(roomId, insightId, runId);
	agentsByRunId.set(runId, agent);
	return agent;
};

/**
 * Register an AgentStore obtained some other way — notably `AgentStore.start`,
 * which constructs its own instance for a run id that did not exist yet.
 *
 * Without this, a freshly submitted run is unreachable from
 * {@link getOrCreateAgent}, so a tool decision made during that first turn
 * would build a second store and poll the same run twice.
 */
export const registerAgent = (agent: AgentStore): void => {
	agentsByRunId.set(agent.runId, agent);
};

/** Terminal statuses. A run in any other status is still the watcher's to poll. */
const isTerminal = (status: AgentRunStatusValue): boolean =>
	status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";

/**
 * Poll a run to completion, resolving with the terminal snapshot.
 *
 * Owns the three things every host gets wrong independently: which statuses end
 * a run, that `stop()` must fire before settling so no further poll lands after
 * the caller has moved on, and that the run must leave the registry whatever
 * happens. Everything host-shaped — mutating a chat store, painting a
 * transcript — goes in `handlers` and runs untouched.
 *
 * `onReconcile` is invoked BEFORE the terminal check, so a host that recovers
 * final text from the durable snapshot has already done so by the time this
 * promise settles.
 *
 * Rejects on FAILED or CANCELLED. A rejection means the run did not complete,
 * NOT that the transport failed — `AgentStore.watch` retries transport errors
 * with backoff and reports them via `handlers.onError` without ending the run.
 */
export const watchAgentRun = (
	agent: AgentStore,
	handlers: AgentWatchHandlers,
	options?: AgentWatchOptions,
): Promise<AgentRunSnapshot> =>
	new Promise<AgentRunSnapshot>((resolve, reject) => {
		agent.watch(
			{
				...handlers,
				onReconcile: (snapshot) => {
					handlers.onReconcile(snapshot);
					if (!isTerminal(snapshot.status)) {
						return;
					}
					agent.stop();
					if (snapshot.status !== "COMPLETED") {
						reject(
							new Error(
								snapshot.errorMessage ||
									`The agent run did not complete: ${snapshot.status}`,
							),
						);
						return;
					}
					resolve(snapshot);
				},
			},
			options,
		);
	}).finally(() => {
		// Only if it is still ours: a later reconnect may already have replaced
		// this entry, and deleting unconditionally would unregister the live
		// watcher instead of the finished one.
		if (agentsByRunId.get(agent.runId) === agent) {
			agentsByRunId.delete(agent.runId);
		}
	});
