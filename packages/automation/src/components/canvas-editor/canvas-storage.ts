/**
 * The canvas keeps an unsaved draft and the dev-mode choice in the browser's
 * storage. Storage can be missing or refuse to answer (a private window, blocked
 * site data, a full quota), and neither value is worth stopping the editor over,
 * so every call here falls back instead of throwing.
 */

const draftKey = (appId: string): string => `automation-draft-${appId}`;
const devModeKey = (appId: string): string => `automation-devmode-${appId}`;

/**
 * The unsaved draft saved for an automation.
 *
 * @param appId - The automation's app id.
 * @returns The stored draft text, or null when there is none or storage is unavailable.
 */
export const readDraft = (appId: string): string | null => {
	try {
		return localStorage.getItem(draftKey(appId));
	} catch {
		return null;
	}
};

/**
 * Save an automation's unsaved draft. Does nothing when storage is unavailable.
 *
 * @param appId - The automation's app id.
 * @param draft - The serialized draft.
 */
export const writeDraft = (appId: string, draft: string): void => {
	try {
		localStorage.setItem(draftKey(appId), draft);
	} catch {
		// the draft is a convenience; losing it only costs a restore on the next visit
	}
};

/**
 * Forget an automation's unsaved draft, after a save, a reload or a bad draft.
 *
 * @param appId - The automation's app id.
 */
export const clearDraft = (appId: string): void => {
	try {
		localStorage.removeItem(draftKey(appId));
	} catch {
		// nothing stored that could be restored
	}
};

/**
 * Whether the person last left the canvas in dev mode (Python source editors).
 *
 * @param appId - The automation's app id.
 * @returns True only when dev mode was saved on; false otherwise or when storage is unavailable.
 */
export const readDevMode = (appId: string): boolean => {
	try {
		return localStorage.getItem(devModeKey(appId)) === "true";
	} catch {
		return false;
	}
};

/**
 * Remember the dev-mode choice. Does nothing when storage is unavailable.
 *
 * @param appId - The automation's app id.
 * @param value - Whether dev mode is on.
 */
export const writeDevMode = (appId: string, value: boolean): void => {
	try {
		localStorage.setItem(devModeKey(appId), String(value));
	} catch {
		// the choice still applies to this visit
	}
};
