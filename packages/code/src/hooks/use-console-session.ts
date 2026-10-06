import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
	createSession,
	describeError,
	roomHistoryLines,
	type Session,
	type SessionCatalog,
	type Translate,
} from "@semoss/agent-core";
import { type OpenedRoom, openRoom } from "@/api";
import { createSessionBackend, downloadRunExport, PLATFORM } from "@/utility";

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
 * @param options.onShowOverlay - Called when an overlay command is invoked.
 * @return Opening the room, failed with a message, or ready with the session,
 * a number that is different for each session it creates, to key a console
 * on, and, for a room it opened, that room's id and name.
 */
export const useConsoleSession = ({
	catalog,
	defaultModelId,
	roomId,
	translate,
	onShowOverlay,
}: {
	catalog: SessionCatalog;
	defaultModelId?: string;
	roomId?: string;
	translate: Translate;
	onShowOverlay?: (name: string) => void;
}):
	| { status: "opening" }
	| { status: "failed"; message: string }
	| {
			status: "ready";
			session: Session;
			generation: number;
			openedRoom?: { roomId: string; insightId: string; name?: string };
	  } => {
	const navigate = useNavigate();
	const [state, setState] = useState<ReturnType<typeof useConsoleSession>>({
		status: "opening",
	});
	const sessionRef = useRef<Session | undefined>(undefined);
	const generationRef = useRef(0);
	/** Where the session is, which is where the URL should be. */
	const sessionRoomRef = useRef<string | undefined>(undefined);
	/**
	 * The insight the session's room is bound to. Needed because `onRoomChange`
	 * only carries a room id, but the :mcp overlay (the only consumer of
	 * `openedRoom`) needs the insight too, and a session that started with no
	 * room learns its insight asynchronously, inside the backend's own
	 * `createRoom` -- there is nowhere else to read it from afterward.
	 */
	const insightIdRef = useRef<string | undefined>(undefined);
	const latest = useRef({
		catalog,
		defaultModelId,
		translate,
		navigate,
		onShowOverlay,
	});

	useLayoutEffect(() => {
		latest.current = {
			catalog,
			defaultModelId,
			translate,
			navigate,
			onShowOverlay,
		};
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
			const { catalog, defaultModelId, translate, onShowOverlay } =
				latest.current;
			insightIdRef.current = room?.insightId;
			const session = createSession({
				backend: createSessionBackend(room?.insightId, (insightId) => {
					insightIdRef.current = insightId;
				}),
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
						// The session just created its first room (or left
						// one with :new): tell the :mcp overlay. insightIdRef
						// is already set by this point -- createRoom's
						// onInsightBound callback runs synchronously before
						// its promise resolves, and this handler only runs
						// after that resolution (see launch() in session.ts).
						setState((state) =>
							state.status === "ready"
								? {
										...state,
										openedRoom:
											next !== undefined &&
											insightIdRef.current
												? {
														roomId: next,
														insightId:
															insightIdRef.current,
													}
												: undefined,
									}
								: state,
						);
					},
					saveExport: downloadRunExport,
					platform: PLATFORM,
					onShowOverlay,
				},
				catalog,
				roomId: room?.roomId,
				// Code terminal always defaults to claude_code harness for its streaming tool call UI
				harness: room?.options.harnessType ?? "claude_code",
				preferredModels: [room?.options.modelId, defaultModelId],
				history: room
					? roomHistoryLines(room.messages, translate)
					: undefined,
				translate,
				// Push-based item events over SSE instead of 500ms polling. Falls
				// back to polling automatically on any transport error (see
				// AgentStore.watch's "sse" transport) -- never thrashes between
				// the two once it has fallen back, for the rest of the run.
				watchOptions: { transport: "sse" },
			});
			sessionRef.current = session;
			setState({
				status: "ready",
				session,
				generation: ++generationRef.current,
				openedRoom: room && {
					roomId: room.roomId,
					insightId: room.insightId,
					name: room.name,
				},
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
