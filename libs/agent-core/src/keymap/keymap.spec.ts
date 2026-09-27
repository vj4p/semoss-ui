import { describe, expect, it } from "vitest";
import {
	approvalKeyLabels,
	chordLabel,
	chordParts,
	DEFAULT_KEYMAP,
	type KeyContext,
	type KeyEventLike,
	matchesChord,
	resolveKey,
} from "./keymap";

const key = (
	value: string,
	extra: Partial<KeyEventLike> = {},
): KeyEventLike => ({
	key: value,
	ctrlKey: false,
	altKey: false,
	shiftKey: false,
	metaKey: false,
	...extra,
});

const idle: KeyContext = {
	running: false,
	hasSelection: false,
	inputEmpty: true,
	caretOnFirstLine: true,
	caretOnLastLine: true,
	approvalReady: false,
};

const running: KeyContext = { ...idle, running: true };

describe("resolveKey", () => {
	it("submits on Enter and leaves Shift+Enter to insert a newline", () => {
		expect(resolveKey(key("Enter"), idle)).toBe("submit");
		expect(resolveKey(key("Enter", { shiftKey: true }), idle)).toBe(
			"newline",
		);
	});

	it("does not treat Enter with another modifier as submit", () => {
		expect(
			resolveKey(key("Enter", { ctrlKey: true }), idle),
		).toBeUndefined();
		expect(
			resolveKey(key("Enter", { metaKey: true }), idle),
		).toBeUndefined();
	});

	it("never acts while an input method is composing", () => {
		expect(
			resolveKey(key("Enter", { isComposing: true }), idle),
		).toBeUndefined();
		// Safari's committing Enter: isComposing false, keyCode 229.
		expect(
			resolveKey(key("Enter", { keyCode: 229 }), idle),
		).toBeUndefined();
	});

	it("walks history only from the edge lines of a multi-line prompt", () => {
		expect(resolveKey(key("ArrowUp"), idle)).toBe("historyPrev");
		expect(resolveKey(key("ArrowDown"), idle)).toBe("historyNext");

		const middle = {
			...idle,
			caretOnFirstLine: false,
			caretOnLastLine: false,
		};
		expect(resolveKey(key("ArrowUp"), middle)).toBeUndefined();
		expect(resolveKey(key("ArrowDown"), middle)).toBeUndefined();
	});

	it("interrupts a run on Ctrl+C or Escape", () => {
		expect(resolveKey(key("c", { ctrlKey: true }), running)).toBe(
			"interrupt",
		);
		expect(resolveKey(key("Escape"), running)).toBe("interrupt");
	});

	it("lets Ctrl+C copy whenever something is selected", () => {
		const selecting = { ...running, hasSelection: true, inputEmpty: false };
		expect(
			resolveKey(key("c", { ctrlKey: true }), selecting),
		).toBeUndefined();
		expect(
			resolveKey(key("c", { ctrlKey: true }), {
				...selecting,
				running: false,
			}),
		).toBeUndefined();
	});

	it("clears a half-typed prompt on Ctrl+C when nothing is running", () => {
		const typing = { ...idle, inputEmpty: false };
		expect(resolveKey(key("c", { ctrlKey: true }), typing)).toBe(
			"clearInput",
		);
		expect(resolveKey(key("c", { ctrlKey: true }), idle)).toBeUndefined();
	});

	it("leaves Escape alone when nothing is running", () => {
		expect(resolveKey(key("Escape"), idle)).toBeUndefined();
	});

	it("clears the screen on Ctrl+L and cycles harnesses on Alt+H", () => {
		expect(resolveKey(key("l", { ctrlKey: true }), idle)).toBe(
			"clearViewport",
		);
		expect(resolveKey(key("h", { altKey: true }), idle)).toBe(
			"cycleHarness",
		);
	});

	it("binds neither Tab nor Shift+Tab, so focus can always leave", () => {
		expect(resolveKey(key("Tab"), idle)).toBeUndefined();
		expect(
			resolveKey(key("Tab", { shiftKey: true }), idle),
		).toBeUndefined();
		expect(
			DEFAULT_KEYMAP.some((binding) => binding.chord.key === "Tab"),
		).toBe(false);
	});

	it("leaves ordinary typing alone", () => {
		expect(resolveKey(key("h"), idle)).toBeUndefined();
		expect(resolveKey(key("c"), running)).toBeUndefined();
	});

	const ready: KeyContext = { ...idle, approvalReady: true };

	it("approves, denies, edits, or always-allows when ready and input is empty", () => {
		expect(resolveKey(key("a"), ready)).toBe("approve");
		expect(resolveKey(key("d"), ready)).toBe("deny");
		expect(resolveKey(key("e"), ready)).toBe("edit");
		expect(resolveKey(key("A", { shiftKey: true }), ready)).toBe(
			"alwaysAllow",
		);
	});

	it("does not decide an approval when not ready", () => {
		expect(resolveKey(key("a"), idle)).toBeUndefined();
		expect(resolveKey(key("d"), idle)).toBeUndefined();
		expect(resolveKey(key("e"), idle)).toBeUndefined();
		expect(resolveKey(key("A", { shiftKey: true }), idle)).toBeUndefined();
	});

	it("does not decide an approval when input is not empty", () => {
		const typing = { ...ready, inputEmpty: false };
		expect(resolveKey(key("a"), typing)).toBeUndefined();
		expect(resolveKey(key("d"), typing)).toBeUndefined();
		expect(resolveKey(key("e"), typing)).toBeUndefined();
		expect(
			resolveKey(key("A", { shiftKey: true }), typing),
		).toBeUndefined();
	});

	it("approves on A without Shift (Caps Lock on)", () => {
		expect(resolveKey(key("A"), ready)).toBe("approve");
	});

	it("does not decide an approval with Ctrl or Meta", () => {
		expect(resolveKey(key("a", { ctrlKey: true }), ready)).toBeUndefined();
		expect(resolveKey(key("a", { metaKey: true }), ready)).toBeUndefined();
	});

	it("follows the letter on a non-Latin layout", () => {
		// Russian layout: "ф" is on the A key.
		expect(resolveKey(key("ф", { code: "KeyA" }), ready)).toBe("approve");
	});

	it("does not match AZERTY's Q key as A", () => {
		// AZERTY: "q" is on the A key, but it's a Latin letter.
		expect(resolveKey(key("q", { code: "KeyA" }), ready)).toBeUndefined();
	});

	it("does not decide an approval while composing", () => {
		expect(
			resolveKey(key("a", { isComposing: true }), ready),
		).toBeUndefined();
	});

	it("takes the first matching binding when several could apply", () => {
		expect(
			resolveKey(key("x"), idle, [
				{
					chord: { key: "x" },
					action: "submit",
					describe: "key.submit",
				},
				{
					chord: { key: "x" },
					action: "newline",
					describe: "key.newline",
				},
			]),
		).toBe("submit");
	});
});

describe("matchesChord", () => {
	it("requires the exact set of modifiers", () => {
		expect(
			matchesChord({ key: "c", ctrl: true }, key("c", { ctrlKey: true })),
		).toBe(true);
		expect(
			matchesChord(
				{ key: "c", ctrl: true },
				key("C", { ctrlKey: true, shiftKey: true }),
			),
		).toBe(false);
	});

	it("matches a letter through Caps Lock", () => {
		expect(
			matchesChord({ key: "c", ctrl: true }, key("C", { ctrlKey: true })),
		).toBe(true);
	});

	it("follows the letter, not the key position, on another Latin layout", () => {
		// Dvorak: the key in QWERTY's I position types "c".
		expect(
			matchesChord(
				{ key: "c", ctrl: true },
				key("c", { ctrlKey: true, code: "KeyI" }),
			),
		).toBe(true);
		// ...and the key in QWERTY's C position types "j", which is not Ctrl+C.
		expect(
			matchesChord(
				{ key: "c", ctrl: true },
				key("j", { ctrlKey: true, code: "KeyC" }),
			),
		).toBe(false);
	});

	it("falls back to the physical key when no Latin letter was produced", () => {
		// macOS Option+H types "˙"; a Russian layout types "р" for H.
		expect(
			matchesChord(
				{ key: "h", alt: true },
				key("˙", { altKey: true, code: "KeyH" }),
			),
		).toBe(true);
		expect(
			matchesChord(
				{ key: "h", alt: true },
				key("р", { altKey: true, code: "KeyH" }),
			),
		).toBe(true);
		expect(
			matchesChord(
				{ key: "h", alt: true },
				key("˙", { altKey: true, code: "KeyJ" }),
			),
		).toBe(false);
	});

	it("matches named keys exactly", () => {
		expect(matchesChord({ key: "Escape" }, key("Escape"))).toBe(true);
		expect(matchesChord({ key: "Escape" }, key("Esc"))).toBe(false);
	});
});

describe("chordParts", () => {
	it("lists modifiers first, in a fixed order", () => {
		expect(
			chordParts({
				key: "k",
				ctrl: true,
				alt: true,
				shift: true,
				meta: true,
			}),
		).toEqual(["Ctrl", "Alt", "Shift", "Meta", "K"]);
	});

	it("names the Mac's own modifier keys", () => {
		expect(chordParts({ key: "h", alt: true }, "mac")).toEqual([
			"Option",
			"H",
		]);
		expect(chordParts({ key: "k", meta: true }, "mac")).toEqual([
			"Cmd",
			"K",
		]);
	});

	it("gives named keys their short labels", () => {
		expect(chordLabel({ key: "Escape" })).toBe("Esc");
		expect(chordLabel({ key: "ArrowUp" })).toBe("↑");
		expect(chordLabel({ key: "Enter", shift: true })).toBe("Shift+Enter");
	});
});

describe("approvalKeyLabels", () => {
	it("returns labels for all four approval actions from the default keymap", () => {
		expect(approvalKeyLabels(DEFAULT_KEYMAP)).toEqual({
			approve: "A",
			deny: "D",
			edit: "E",
			always: "Shift+A",
		});
	});

	it("returns undefined when any action is missing from the keymap", () => {
		const incomplete = DEFAULT_KEYMAP.filter(
			(b) => b.action !== "alwaysAllow",
		);
		expect(approvalKeyLabels(incomplete)).toBeUndefined();
	});
});
