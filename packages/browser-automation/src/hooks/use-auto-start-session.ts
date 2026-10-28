import { useCallback, useEffect, useRef } from "react";
import type { RemoteBrowserSessionInfo } from "../types/browserEvents";

const VIEWPORT_WIDTH = 1365;
const VIEWPORT_HEIGHT = 768;

/** Opens a remote browser session; resolves null, after surfacing the error, when it cannot. */
type CreateSession = (
	url?: string,
	width?: number,
	height?: number,
	preserveExisting?: boolean,
) => Promise<RemoteBrowserSessionInfo | null>;

/** Inputs for {@link useAutoStartSession}. */
export interface UseAutoStartSessionOptions {
	/** The tool context has been read; nothing starts before it has. */
	isReady: boolean;
	/** A session is already open. */
	hasSession: boolean;
	/** A session is being opened right now. */
	isCreating: boolean;
	/** Running inside a Playground tool call rather than standalone. */
	isPlaygroundMode: boolean;
	/** The page to open first. Playground mode waits until it is known. */
	startupUrl: string;
	/**
	 * Identifies the current tool execution. A new, non-empty value allows one more
	 * automatic start; an empty one changes nothing.
	 */
	rearmKey: string;
	createSession: CreateSession;
	/** Called as the start begins, with the page being opened. */
	onStarting: (startupUrl: string) => void;
	/** Called when the session opened, unless the host has unmounted since. */
	onStarted: (info: RemoteBrowserSessionInfo, startupUrl: string) => void;
}

/** What {@link useAutoStartSession} lets its host control. */
export interface AutoStartSession {
	/**
	 * Counts an explicit start as the automatic one. A failure of it is then not
	 * retried automatically either; the person asks again.
	 */
	markStarted: () => void;
}

/**
 * Opens the remote browser once, as soon as the host is ready.
 *
 * A failed start stays spent. Clearing the guard when it fails would let the
 * effect run again as soon as `isCreating` clears, so a browser that cannot start
 * would be retried endlessly. The host keeps its error banner up and its start
 * button asks again on request; only a new `rearmKey` (a new tool execution)
 * allows another automatic attempt.
 */
export function useAutoStartSession({
	isReady,
	hasSession,
	isCreating,
	isPlaygroundMode,
	startupUrl,
	rearmKey,
	createSession,
	onStarting,
	onStarted,
}: UseAutoStartSessionOptions): AutoStartSession {
	const startedRef = useRef(false);
	const mountedRef = useRef(false);
	const rearmKeyRef = useRef(rearmKey);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		if (!isReady || hasSession || isCreating) return;
		if (isPlaygroundMode && !startupUrl) return;
		// A new tool execution is armed here, where the start is decided, so the
		// effect also runs again when only the key changed.
		if (rearmKey && rearmKeyRef.current !== rearmKey) {
			rearmKeyRef.current = rearmKey;
			startedRef.current = false;
		}
		if (startedRef.current) return;

		startedRef.current = true;
		onStarting(startupUrl);
		void createSession(
			isPlaygroundMode ? startupUrl : "",
			VIEWPORT_WIDTH,
			VIEWPORT_HEIGHT,
			!isPlaygroundMode,
		).then((info) => {
			if (!info || !mountedRef.current) return;
			onStarted(info, startupUrl);
		});
	}, [
		createSession,
		hasSession,
		isCreating,
		isPlaygroundMode,
		isReady,
		onStarted,
		onStarting,
		rearmKey,
		startupUrl,
	]);

	const markStarted = useCallback(() => {
		startedRef.current = true;
	}, []);

	return { markStarted };
}
