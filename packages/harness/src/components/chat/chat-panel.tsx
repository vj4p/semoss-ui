import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoomRecord } from "@semoss/sdk";
import { Button, Textarea, toast } from "@semoss/ui/next";
import { useAgentSession } from "../../hooks/use-agent-session";
import { MessageThread } from "./message-thread";

interface ChatPanelProps {
	projectId: string;
	insightId: string;
}

interface PendingSession {
	roomId: string;
	initialCommand: string;
}

interface ChatComposerProps {
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	disabled: boolean;
}

/**
 * Textarea + send button, shared by the pre-room and active-session states
 * below so the two never visually drift apart.
 */
const ChatComposer = ({
	value,
	onChange,
	onSend,
	disabled,
}: ChatComposerProps) => {
	return (
		<div className="flex gap-2 border-t p-3">
			<Textarea
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						onSend();
					}
				}}
				placeholder="Ask Semoss Code to make a change…"
				disabled={disabled}
				className="flex-1"
			/>
			<Button onClick={onSend} disabled={disabled || !value.trim()}>
				<Send className="size-4" />
			</Button>
		</div>
	);
};

interface ActiveChatSessionProps {
	roomId: string;
	insightId: string;
	projectId: string;
	initialCommand: string;
}

/**
 * Owns `useAgentSession` for one already-created room.
 *
 * `ChatPanel` below mounts this with `key={roomId}` only once a room
 * exists, so `roomId` is fixed for this component's entire lifetime and
 * `send`'s closure (captured by `useAgentSession`'s `useCallback([roomId,
 * insightId])`) is correct from the very first render. This split is
 * required, not a style choice: a single component that calls
 * `useAgentSession(roomIdRef.current ?? "", insightId)` and later mutates
 * `roomIdRef.current` cannot work, because mutating a ref does not
 * re-render (so the hook never re-runs with the new id), and mutating
 * state instead doesn't help either -- the handler that triggered the
 * update already captured and is about to call the old `send` closure
 * before React processes the state change. Mounting a fresh component
 * once the real id is known sidesteps the problem instead of chasing it.
 */
const ActiveChatSession = ({
	roomId,
	insightId,
	projectId,
	initialCommand,
}: ActiveChatSessionProps) => {
	const { items, status, send } = useAgentSession(roomId, insightId);
	const [draft, setDraft] = useState("");
	const hasSentInitialCommand = useRef(false);

	useEffect(() => {
		// Guard against Strict Mode's dev-only double-invoke of mount effects,
		// which would otherwise send the user's first message twice.
		if (hasSentInitialCommand.current) return;
		hasSentInitialCommand.current = true;
		void send(initialCommand, projectId);
	}, [initialCommand, projectId, send]);

	const handleSend = useCallback(async () => {
		const command = draft.trim();
		if (!command) return;
		setDraft("");
		await send(command, projectId);
	}, [draft, projectId, send]);

	return (
		<div className="flex h-full flex-col">
			<MessageThread items={items} />
			<ChatComposer
				value={draft}
				onChange={setDraft}
				onSend={() => void handleSend()}
				disabled={status === "RUNNING"}
			/>
		</div>
	);
};

/**
 * Chat composer + message thread for one SEMOSS Code project workspace.
 *
 * Room creation is lazy: there is nothing to chat with until the user
 * sends a first message, so `ChatPanel` itself never calls
 * `useAgentSession` -- it only owns the pre-room draft text and the
 * `createRoomRecord` call. Once that resolves, `ActiveChatSession` (keyed
 * by the new `roomId`) takes over for the rest of the session. See that
 * component's doc comment for why this two-component split exists.
 */
export const ChatPanel = ({ projectId, insightId }: ChatPanelProps) => {
	const [draft, setDraft] = useState("");
	const [isPreparingRoom, setIsPreparingRoom] = useState(false);
	const [session, setSession] = useState<PendingSession | null>(null);

	const handleFirstSend = useCallback(async () => {
		const command = draft.trim();
		if (!command || isPreparingRoom) return;
		setDraft("");
		setIsPreparingRoom(true);
		try {
			const room = await createRoomRecord(insightId, projectId);
			setSession({ roomId: room.roomId, initialCommand: command });
		} catch (e) {
			console.error(e);
			toast.error("Failed to start chat.");
			setDraft(command);
		} finally {
			setIsPreparingRoom(false);
		}
	}, [draft, insightId, projectId, isPreparingRoom]);

	if (session) {
		return (
			<ActiveChatSession
				key={session.roomId}
				roomId={session.roomId}
				insightId={insightId}
				projectId={projectId}
				initialCommand={session.initialCommand}
			/>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
				Start chatting to begin.
			</div>
			<ChatComposer
				value={draft}
				onChange={setDraft}
				onSend={() => void handleFirstSend()}
				disabled={isPreparingRoom}
			/>
		</div>
	);
};
