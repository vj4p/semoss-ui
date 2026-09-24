import { useEffect, useRef } from "react";
import {
	activeRunEntry,
	type Session,
	type Translate,
} from "@semoss/agent-core";
import { useSessionState } from "@/hooks";
import { Announcer } from "./announcer";
import { PendingActions } from "./pending-actions";
import { PromptInput } from "./prompt-input";
import { StatusBar } from "./status-bar";
import { Transcript } from "./transcript";

/**
 * One session, as a terminal: the transcript, what the run is waiting on,
 * the prompt, and the status bar, top to bottom.
 *
 * The prompt has focus from the start, since typing into it is what the
 * console is for, and every decision made elsewhere sends focus back to it.
 * Mount one per session: nothing in it carries over to another.
 *
 * @name Console
 * @param props.session - The session to show.
 * @param props.openedRoom - The room the session opened, for its name.
 * @param props.translate - Translate for agent-core's messages, in the
 * current language.
 */
export const Console = ({
	session,
	openedRoom,
	translate,
}: {
	session: Session;
	openedRoom?: { roomId: string; name?: string };
	translate: Translate;
}) => {
	const state = useSessionState(session);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const run = activeRunEntry(state);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	return (
		<>
			<Transcript entries={state.entries} translate={translate} />
			{run !== undefined && run.pendingActions.length > 0 && (
				<PendingActions
					run={run}
					session={session}
					translate={translate}
					returnFocus={() => inputRef.current?.focus()}
				/>
			)}
			<PromptInput
				session={session}
				running={state.activeEntryId !== undefined}
				inputRef={inputRef}
			/>
			<StatusBar
				state={state}
				session={session}
				openedRoom={openedRoom}
			/>
			<Announcer session={session} translate={translate} />
		</>
	);
};
