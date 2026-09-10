import { useCallback, useRef, useState } from "react";
import type { AgentRunItem, AgentRunSubscription } from "@semoss/sdk";
import { AgentStore } from "@semoss/sdk";

export type AgentSessionStatus = "IDLE" | "RUNNING" | "DONE" | "ERROR";

export interface UseAgentSessionResult {
	items: AgentRunItem[];
	status: AgentSessionStatus;
	send: (command: string, workspaceId?: string) => Promise<void>;
}

/**
 * Drive one `claude_code`-harness agent run via the SDK's `AgentStore` and
 * expose its live item stream plus a coarse status to a chat UI.
 *
 * `harnessType: "claude_code"` is hardcoded deliberately: this whole package
 * exists specifically to drive that harness, unlike Playground/the client
 * Assistant panel, which need the workspace-level "semoss" harness fallback.
 *
 * Status mapping note: `AgentWatchHandlers.onReconcile` fires once per
 * transition into INPUT_REQUIRED (paused for a human tool-call decision) in
 * addition to firing on a genuine terminal status. This hook's status enum
 * has no dedicated "paused" value -- this package builds no decide()-driven
 * HITL UI yet -- so INPUT_REQUIRED is reported as "RUNNING" rather than
 * "ERROR": the run has not failed, it is only waiting. This mirrors how the
 * existing agent-run consumers elsewhere in this monorepo already treat
 * INPUT_REQUIRED as a non-error pause, not a failure (see
 * playground's agent-harness.ts settleTerminal, which only settles the
 * watch promise on COMPLETED/FAILED/CANCELLED, and client's
 * workbench-assistant.slice.ts submit(), which raises no failure notice for
 * an INPUT_REQUIRED outcome). A later task can introduce a dedicated
 * "AWAITING_INPUT" status once this package adds HITL rendering.
 */
export const useAgentSession = (
	roomId: string,
	insightId: string,
): UseAgentSessionResult => {
	const [items, setItems] = useState<AgentRunItem[]>([]);
	const [status, setStatus] = useState<AgentSessionStatus>("IDLE");
	const subscriptionRef = useRef<AgentRunSubscription | null>(null);

	const send = useCallback(
		async (command: string, workspaceId?: string) => {
			setStatus("RUNNING");
			try {
				const store = await AgentStore.start(
					{
						roomId,
						command,
						harnessType: "claude_code",
						agentId: workspaceId,
					},
					insightId,
				);
				const subscription = store.watch({
					onEvent: (_event, itemsState) => {
						setItems(
							itemsState.itemOrder.map(
								(id) => itemsState.itemsById[id],
							),
						);
					},
					onSnapshot: (_snapshot, meta) => {
						// No HITL UI reads the durable snapshot yet (no
						// pendingActions rendering in this package), so
						// there is nothing to reconcile here beyond
						// surfacing a real gap in the event feed, which
						// would otherwise pass silently.
						if (meta.droppedEvents > 0) {
							console.warn(
								`useAgentSession: dropped ${meta.droppedEvents} event(s) before this poll drain`,
							);
						}
					},
					onReconcile: (snapshot) => {
						if (snapshot.status === "COMPLETED") {
							setStatus("DONE");
						} else if (snapshot.status === "INPUT_REQUIRED") {
							setStatus("RUNNING");
						} else {
							setStatus("ERROR");
						}
					},
				});
				subscriptionRef.current = subscription;
			} catch (e) {
				console.error(e);
				setStatus("ERROR");
			}
		},
		[roomId, insightId],
	);

	return { items, status, send };
};
