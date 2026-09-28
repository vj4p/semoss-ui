import {
	approvalKeyLabels,
	DEFAULT_KEYMAP,
	type Platform,
	type RunLinesOptions,
} from "@semoss/agent-core";

/**
 * Which keyboard the console names keys for, in `:help` and in the approval
 * hints: a Mac's Alt key says Option.
 */
export const PLATFORM: Platform = /Mac|iPhone|iPad/.test(navigator.userAgent)
	? "mac"
	: "other";

/**
 * The keys that decide a waiting tool call from the prompt, as the hints name
 * them. Undefined if the keymap leaves one of the four unbound, and the hints
 * then name the commands instead.
 */
export const APPROVAL_KEYS = approvalKeyLabels(DEFAULT_KEYMAP, PLATFORM);

/**
 * How the console draws a run, for the transcript and the announcer alike, so
 * that what a screen reader hears is what the transcript shows.
 */
export const RUN_LINES_OPTIONS: RunLinesOptions = {
	approvalKeys: APPROVAL_KEYS,
};
