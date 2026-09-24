/**
 * Which key does what at the prompt, as data.
 *
 * Bindings are data rather than handlers for the same reason commands are:
 * the prompt that acts on them and the `:help` that lists them must read one
 * definition, and a user-editable keymap (Phase 6) can only replace data.
 *
 * <h4>What is deliberately not bound</h4>
 *
 * Tab and Shift+Tab. They move focus, and a text box that swallows them
 * traps a keyboard user inside it (WCAG 2.1.2). Completion, when it comes,
 * gets another key.
 *
 * Ctrl+H, which the plan first proposed for cycling harnesses. On macOS it is
 * the system's delete-backward inside any text field, so binding it would
 * break a Mac user's editing to save a keystroke. Alt+H cycles instead.
 *
 * <h4>Matching</h4>
 *
 * Modifiers match exactly: a chord that names no modifier matches only when
 * none is held, so Shift+Enter can never also fire Enter. A letter matches on
 * the character the key produced, so a binding follows the letter on a
 * Dvorak or AZERTY layout rather than a key position. Only when the key did
 * not produce a Latin letter — Option+H is "˙" on a Mac, H is "р" on a
 * Russian layout — does it fall back to the physical key.
 *
 * Nothing matches while an input method is composing. Enter then commits the
 * composition, and treating it as submit would send a half-typed Japanese
 * prompt.
 */

import type { MessageKey } from "../i18n/messages";

export type KeyAction =
	| "submit"
	/**
	 * Shift+Enter. The host does nothing and lets the text box insert the
	 * newline itself; the binding exists so the key is documented, and so
	 * nothing else can claim the chord.
	 */
	| "newline"
	| "historyPrev"
	| "historyNext"
	| "interrupt"
	| "clearInput"
	| "clearViewport"
	| "cycleHarness";

/** The subset of a DOM `KeyboardEvent` matching reads, so a CLI can build one. */
export interface KeyEventLike {
	key: string;
	code?: string;
	/** Safari reports an IME's committing Enter with `isComposing` false and this set to 229. */
	keyCode?: number;
	ctrlKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
	metaKey: boolean;
	isComposing?: boolean;
}

/** What the prompt knows at the moment a key is pressed. */
export interface KeyContext {
	running: boolean;
	/** True when Ctrl+C here would copy something, which must win over interrupting. */
	hasSelection: boolean;
	inputEmpty: boolean;
	/** ↑ recalls history only from the first line, so it still moves the caret in a multi-line prompt. */
	caretOnFirstLine: boolean;
	caretOnLastLine: boolean;
}

export interface Chord {
	/** A `KeyboardEvent.key` value such as `"Enter"`, or one lowercase letter. */
	key: string;
	ctrl?: boolean;
	alt?: boolean;
	shift?: boolean;
	meta?: boolean;
}

export interface KeyBinding {
	chord: Chord;
	action: KeyAction;
	/** Every listed field must equal the context's for the binding to apply. */
	when?: Partial<KeyContext>;
	describe: MessageKey;
}

/**
 * The default bindings, in priority order: the first that matches wins.
 *
 * Ctrl+C carries two actions on disjoint conditions, which is the terminal
 * idiom exactly — it interrupts a running agent, clears a half-typed prompt
 * otherwise, and copies whenever something is selected.
 */
export const DEFAULT_KEYMAP: readonly KeyBinding[] = [
	{ chord: { key: "Enter" }, action: "submit", describe: "key.submit" },
	{
		chord: { key: "Enter", shift: true },
		action: "newline",
		describe: "key.newline",
	},
	{
		chord: { key: "ArrowUp" },
		action: "historyPrev",
		when: { caretOnFirstLine: true },
		describe: "key.historyPrev",
	},
	{
		chord: { key: "ArrowDown" },
		action: "historyNext",
		when: { caretOnLastLine: true },
		describe: "key.historyNext",
	},
	{
		chord: { key: "c", ctrl: true },
		action: "interrupt",
		when: { running: true, hasSelection: false },
		describe: "key.interrupt",
	},
	{
		chord: { key: "Escape" },
		action: "interrupt",
		when: { running: true },
		describe: "key.interrupt",
	},
	{
		chord: { key: "c", ctrl: true },
		action: "clearInput",
		when: { running: false, hasSelection: false, inputEmpty: false },
		describe: "key.clearInput",
	},
	{
		chord: { key: "l", ctrl: true },
		action: "clearViewport",
		describe: "key.clearViewport",
	},
	{
		chord: { key: "h", alt: true },
		action: "cycleHarness",
		describe: "key.cycleHarness",
	},
];

const LETTER = /^[a-z]$/;

export const matchesChord = (chord: Chord, event: KeyEventLike): boolean => {
	if (
		Boolean(chord.ctrl) !== event.ctrlKey ||
		Boolean(chord.alt) !== event.altKey ||
		Boolean(chord.shift) !== event.shiftKey ||
		Boolean(chord.meta) !== event.metaKey
	) {
		return false;
	}
	if (!LETTER.test(chord.key)) {
		return event.key === chord.key;
	}
	const typed = event.key.toLowerCase();
	return LETTER.test(typed)
		? typed === chord.key
		: event.code === `Key${chord.key.toUpperCase()}`;
};

export const isComposing = (event: KeyEventLike): boolean =>
	event.isComposing === true || event.keyCode === 229;

const applies = (when: Partial<KeyContext> | undefined, context: KeyContext) =>
	when === undefined ||
	(Object.keys(when) as (keyof KeyContext)[]).every(
		(field) => when[field] === context[field],
	);

/**
 * @return the action for this key press, or undefined to let the key do what
 * it would have done anyway. A host must not prevent the default on
 * undefined, and must not prevent it on `newline` either.
 */
export const resolveKey = (
	event: KeyEventLike,
	context: KeyContext,
	keymap: readonly KeyBinding[] = DEFAULT_KEYMAP,
): KeyAction | undefined => {
	if (isComposing(event)) {
		return undefined;
	}
	return keymap.find(
		(binding) =>
			matchesChord(binding.chord, event) &&
			applies(binding.when, context),
	)?.action;
};

export type Platform = "mac" | "other";

const KEY_LABEL: Partial<Record<string, string>> = {
	Enter: "Enter",
	Escape: "Esc",
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
	" ": "Space",
};

/**
 * A chord as the keys a person presses, for a host to draw as key caps.
 *
 * Key names stay in English in every language. That is common practice, and
 * Ctrl, Alt and Esc are printed in English on most keyboards these languages
 * are typed on; a Spanish or French keyboard may print its own word for Enter
 * or Shift, which is a known compromise. Only the Alt key's name changes by
 * platform, because a Mac prints "option" on it.
 */
export const chordParts = (
	chord: Chord,
	platform: Platform = "other",
): string[] => {
	const parts: string[] = [];
	if (chord.ctrl) {
		parts.push("Ctrl");
	}
	if (chord.alt) {
		parts.push(platform === "mac" ? "Option" : "Alt");
	}
	if (chord.shift) {
		parts.push("Shift");
	}
	if (chord.meta) {
		parts.push(platform === "mac" ? "Cmd" : "Meta");
	}
	parts.push(KEY_LABEL[chord.key] ?? chord.key.toUpperCase());
	return parts;
};

export const chordLabel = (chord: Chord, platform?: Platform): string =>
	chordParts(chord, platform).join("+");
