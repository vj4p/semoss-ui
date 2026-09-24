import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
	createSession,
	describeError,
	type Platform,
	roomHistoryLines,
	type Session,
	type SessionCatalog,
	type Translate,
} from "@semoss/agent-core";
import { type OpenedRoom, openRoom } from "@/api";
import { createSessionBackend, downloadRunExport } from "@/utility";

/** How `:help` names the keys: a Mac's Alt key says Option. */
const PLATFORM: Platform = /Mac|iPhone|iPad/.test(navigator.userAgent)
	? "mac"
	: "other";

/**
 * The console's session, in the room the URL names, or in a new room when it
 * names none.
 *
 * The URL follows the session as much as the other way round. A session that
 * creates a room with its first prompt, or leaves one with `:new`, says so
 * through `onRoomChange`, and the URL is changed to match; the session
 * carries on. Only a URL that moves anywhere else, by the address bar or the
 * back button, puts a new session in its place.
 *
 * The catalog, the default model and the translate function are what the
 * session is created with, and the session keeps them. A change to them later
 * is not a reason to create it again, which would clear the transcript and
 * stop following a run: the catalog changes identity each time the harness
 * hook's translation does, and the translate function each time the language
 * changes. The session's translate reads the language on every call, so it
 * goes on speaking the current one.
 *
 * @name useConsoleSession
 * @param options.catalog - The harnesses and models to offer.
 * @param options.defaultModelId - The user's default model, if they have one.
 * @param options.roomId - The room the URL names.
 * @param options.translate - Translate for the session's own messages.
 * @return Opening the room, failed with a message, or ready with the session,
 * a number that is different for each session it creates, to key a console
 * on, and, for a room it opened, that room's id and name.
 */
export const useConsoleSession = ({
	catalog,
	defaultModelId,
	roomId,
	translate,
}: {
	catalog: SessionCatalog;
	defaultModelId?: string;
	roomId?: string;
	translate: Translate;
}):
	| { status: "opening" }
	| { status: "failed"; message: string }
	| {
			status: "ready";
			session: Session;
			generation: number;
			openedRoom?: { roomId: string; name?: string };
	  } => {
	const navigate = useNavigate();
	const [state, setState] = useState<ReturnType<typeof useConsoleSession>>({
		status: "opening",
	});
	const sessionRef = useRef<Session | undefined>(undefined);
	const generationRef = useRef(0);
	/** Where the session is, which is where the URL should be. */
	const sessionRoomRef = useRef<string | undefined>(undefined);
	const latest = useRef({ catalog, defaultModelId, translate, navigate });

	useLayoutEffect(() => {
		latest.current = { catalog, defaultModelId, translate, navigate };
	});

	// A layout effect, so that a console with no room to open never paints
	// the "opening" state for a frame before its session is there.
	useLayoutEffect(() => {
		if (
			sessionRef.current !== undefined &&
			sessionRoomRef.current === roomId
		) {
			return;
		}
		sessionRef.current?.dispose();
		sessionRef.current = undefined;
		sessionRoomRef.current = roomId;

		const start = (room?: OpenedRoom) => {
			const { catalog, defaultModelId, translate } = latest.current;
			const session = createSession({
				backend: createSessionBackend(room?.insightId),
				host: {
					onRoomChange: (next) => {
						const previous = sessionRoomRef.current;
						// Before navigating, so that this effect finds the
						// session already in the room the URL moves to.
						sessionRoomRef.current = next;
						if (next === previous) {
							return;
						}
						// A room the session created replaces the new-room URL,
						// which no longer leads anywhere. Leaving one is a step
						// the back button can undo.
						latest.current.navigate(
							next === undefined
								? "/"
								: `/room/${encodeURIComponent(next)}`,
							{ replace: next !== undefined },
						);
					},
					saveExport: downloadRunExport,
					platform: PLATFORM,
				},
				catalog,
				roomId: room?.roomId,
				harness: room?.options.harnessType,
				preferredModels: [room?.options.modelId, defaultModelId],
				history: room
					? roomHistoryLines(room.messages, translate)
					: undefined,
				translate,
			});
			sessionRef.current = session;
			setState({
				status: "ready",
				session,
				generation: ++generationRef.current,
				openedRoom: room && { roomId: room.roomId, name: room.name },
			});
		};

		if (roomId === undefined) {
			start();
			return;
		}

		let cancelled = false;
		setState({ status: "opening" });
		openRoom(roomId).then(
			(room) => {
				if (!cancelled) {
					start(room);
				}
			},
			(error: unknown) => {
				if (!cancelled) {
					setState({
						status: "failed",
						message: describeError(error),
					});
				}
			},
		);
		return () => {
			cancelled = true;
		};
	}, [roomId]);

	useEffect(
		() => () => {
			sessionRef.current?.dispose();
			sessionRef.current = undefined;
		},
		[],
	);

	return state;
};
