import { useSyncExternalStore } from "react";
import type { Session, SessionState } from "@semoss/agent-core";

/**
 * The session's state, rendering again on each change to it.
 *
 * @name useSessionState
 * @param session - The session to read.
 * @return Its current state.
 */
export const useSessionState = (session: Session): SessionState =>
	useSyncExternalStore(session.subscribe, session.getState);
