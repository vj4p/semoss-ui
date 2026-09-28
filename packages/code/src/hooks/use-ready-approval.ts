import { useEffect, useState } from "react";
import { APPROVAL_KEY_DELAY_MS } from "@semoss/agent-core";
import type { PendingAgentAction } from "@semoss/sdk/react";

/**
 * The tool call the approval keys may decide: the one they act on, once it
 * has been on screen for `APPROVAL_KEY_DELAY_MS`.
 *
 * The delay starts again whenever that call changes, so that a key pressed
 * twice cannot decide the call that replaced the first, and again when the
 * same call comes back after another. A key already on its way when a call
 * appears therefore types instead of deciding it.
 *
 * @name useReadyApproval
 * @param keyed - The call the approval keys act on, from `keyedApproval`.
 * @return That call once it is ready for the keys, or undefined.
 */
export const useReadyApproval = (
	keyed: PendingAgentAction | undefined,
): PendingAgentAction | undefined => {
	const actionId = keyed?.actionId;
	const [readyId, setReadyId] = useState<string>();

	useEffect(() => {
		setReadyId(undefined);
		if (actionId === undefined) {
			return;
		}
		const timer = window.setTimeout(
			() => setReadyId(actionId),
			APPROVAL_KEY_DELAY_MS,
		);
		return () => window.clearTimeout(timer);
	}, [actionId]);

	return keyed !== undefined && keyed.actionId === readyId
		? keyed
		: undefined;
};
