import { useCallback, useEffect, useRef, useState } from "react";

/** A copy of the canvas from before an assistant edit, and the revision that edit produced. */
export interface UndoPoint<TCanvas> {
	canvas: TCanvas;
	baseRevision: string;
}

export interface AssistantUndoOptions<TCanvas> {
	/** The automation being edited; another one leaves nothing to undo. */
	appId: string;
	/** Whether the canvas has unsaved edits made by hand. */
	isDirty: boolean;
	/** The canvas as it is now; null before anything has loaded. */
	getCanvas: () => TCanvas | null;
	/** Saves a canvas again, guarded by the revision. Rejects if the save fails. */
	restore: (canvas: TCanvas, baseRevision: string) => Promise<void>;
	/** Re-reads the saved automation after a successful undo. */
	reload: () => void;
}

export type AssistantUndoResult = { ok: true } | { ok: false; error: unknown };

/**
 * Lets the person undo what the assistant just did to an automation.
 *
 * The assistant's tools save each edit at once, so undoing cannot restore client
 * state: it saves the canvas as it was before the edit, naming the revision the
 * edit produced, so the server refuses it if anyone has saved since. The first
 * copy of a run of edits is the one kept. Edits made by hand, saving, or opening
 * another automation leave nothing to undo safely, so they clear it.
 */
export function useAssistantUndo<TCanvas>(
	options: AssistantUndoOptions<TCanvas>,
) {
	const { appId, isDirty } = options;
	const [point, setPoint] = useState<UndoPoint<TCanvas> | null>(null);
	const [undoing, setUndoing] = useState(false);
	const pointRef = useRef<UndoPoint<TCanvas> | null>(null);
	const pendingRef = useRef<TCanvas | null>(null);
	const optionsRef = useRef(options);
	optionsRef.current = options;

	const clear = useCallback(() => {
		pointRef.current = null;
		pendingRef.current = null;
		setPoint(null);
	}, []);

	/** Call when an assistant edit is about to replace the canvas. */
	const noteAssistantEdit = useCallback(() => {
		pendingRef.current =
			pointRef.current?.canvas ?? optionsRef.current.getCanvas();
	}, []);

	/** Call when the saved automation has been loaded, with its revision. */
	const noteLoaded = useCallback((revision: string | null | undefined) => {
		const canvas = pendingRef.current;
		if (!canvas || !revision) return;
		pendingRef.current = null;
		const next = { canvas, baseRevision: revision };
		pointRef.current = next;
		setPoint(next);
	}, []);

	useEffect(() => {
		if (isDirty) clear();
	}, [isDirty, clear]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: another automation is the trigger
	useEffect(() => {
		clear();
	}, [appId, clear]);

	const undo = useCallback(async (): Promise<AssistantUndoResult> => {
		const current = pointRef.current;
		if (!current) return { ok: false, error: new Error("Nothing to undo") };
		setUndoing(true);
		try {
			await optionsRef.current.restore(
				current.canvas,
				current.baseRevision,
			);
			clear();
			optionsRef.current.reload();
			return { ok: true };
		} catch (error) {
			// a refused save means the copy is stale; do not offer it again
			clear();
			return { ok: false, error };
		} finally {
			setUndoing(false);
		}
	}, [clear]);

	return {
		/** Whether there is an edit to undo. */
		available: point !== null,
		undoing,
		noteAssistantEdit,
		noteLoaded,
		clear,
		undo,
	};
}
