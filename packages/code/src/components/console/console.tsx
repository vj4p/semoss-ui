import { useEffect, useRef } from "react";
import {
	keyedApproval,
	type Session,
	type Translate,
	waitingActions,
} from "@semoss/agent-core";
import { useReadyApproval, useSessionState } from "@/hooks";
import { Announcer } from "./announcer";
import { PendingActions } from "./pending-actions";
import { type PromptHandle, PromptInput } from "./prompt-input";
import { StatusBar } from "./status-bar";
import { Transcript } from "./transcript";

/**
 * One session, as a terminal: the transcript, what its runs wait on the user
 * for, the prompt, and the status bar, top to bottom. What waits is looked
 * for in every entry, not only the run in progress, since a subagent can
 * still wait after the run that spawned it has ended.
 *
 * The prompt has focus from the start, since typing into it is what the
 * console is for, and every decision made elsewhere sends focus back to it.
 * Mount one per session: nothing in it carries over to another.
 *
 * A tool call waiting for approval is ready for the approval keys a moment
 * after it appears. The console keeps track of that for the prompt, which
 * acts on the keys, and for the call's buttons, which show them; Edit on
 * those fills the prompt as the E key does.
 *
 * @name Console
 * @param props.session - The session to show.
 * @param props.openedRoom - The room the session opened, for its name.
 * @param props.translate - Translate for agent-core's messages, in the
 * current language.
 * @param props.onShowFiles - Called when file explorer button is clicked.
 */
export const Console = ({
	session,
	openedRoom,
	translate,
	onShowFiles,
}: {
	session: Session;
	openedRoom?: { roomId: string; name?: string };
	translate: Translate;
	onShowFiles?: () => void;
}) => {
	const state = useSessionState(session);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const promptRef = useRef<PromptHandle>(null);
	const waiting = waitingActions(state, translate);
	const keyed = keyedApproval(state);
	const ready = useReadyApproval(keyed);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	return (
		<>
			<Transcript
				entries={state.entries}
				translate={translate}
				keyedActionId={keyed?.actionId}
			/>
			{waiting.length > 0 && (
				<PendingActions
					waiting={waiting}
					session={session}
					translate={translate}
					ready={ready}
					returnFocus={() => inputRef.current?.focus()}
					onEdit={(text) => promptRef.current?.fill(text)}
				/>
			)}
			<PromptInput
				session={session}
				running={state.activeEntryId !== undefined}
				ready={ready}
				inputRef={inputRef}
				handleRef={promptRef}
			/>
			<StatusBar
				state={state}
				session={session}
				openedRoom={openedRoom}
				onShowFiles={onShowFiles}
			/>
			<Announcer session={session} translate={translate} />
		</>
	);
};
