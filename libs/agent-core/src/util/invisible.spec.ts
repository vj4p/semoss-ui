import { describe, expect, it } from "vitest";
import { escapeInvisibleInJson, revealInvisible } from "./invisible";

describe("revealInvisible", () => {
	it("reveals RLO as a marker", () => {
		const rlo = String.fromCodePoint(0x202e);
		const input = `a${rlo}b`;
		const expected = "a⟨U+202E⟩b";
		expect(revealInvisible(input)).toBe(expected);
	});

	it("reveals LRI, PDI, and ZWSP", () => {
		const lri = String.fromCodePoint(0x2066);
		const pdi = String.fromCodePoint(0x2069);
		const zwsp = String.fromCodePoint(0x200b);
		const input = `${lri}text${pdi}${zwsp}`;
		const expected = "⟨U+2066⟩text⟨U+2069⟩⟨U+200B⟩";
		expect(revealInvisible(input)).toBe(expected);
	});

	it("reveals BOM", () => {
		const bom = String.fromCodePoint(0xfeff);
		const input = `${bom}content`;
		const expected = "⟨U+FEFF⟩content";
		expect(revealInvisible(input)).toBe(expected);
	});

	it("leaves plain ASCII unchanged", () => {
		const input = "hello world";
		expect(revealInvisible(input)).toBe(input);
	});

	it("leaves Arabic letters unchanged", () => {
		const input = "مرحبا";
		expect(revealInvisible(input)).toBe(input);
	});

	it("leaves ZWJ emoji sequences unchanged", () => {
		const zwj = String.fromCodePoint(0x200d);
		const input = `👨${zwj}👩${zwj}👧`;
		expect(revealInvisible(input)).toBe(input);
	});
});

describe("escapeInvisibleInJson", () => {
	it("escapes RLO as JSON escape text", () => {
		const rlo = String.fromCodePoint(0x202e);
		const json = JSON.stringify({ c: `x${rlo}y` });
		const escaped = escapeInvisibleInJson(json);
		expect(escaped).toContain(`${String.fromCodePoint(92)}u202e`);
		expect(escaped).not.toContain(rlo);
	});

	it("parses back to the original value", () => {
		const rlo = String.fromCodePoint(0x202e);
		const original = { c: `x${rlo}y` };
		const json = JSON.stringify(original);
		const escaped = escapeInvisibleInJson(json);
		const parsed = JSON.parse(escaped);
		expect(parsed).toEqual(original);
	});

	it("escaped text contains no raw bidi character", () => {
		const rlo = String.fromCodePoint(0x202e);
		const json = JSON.stringify({ c: `x${rlo}y` });
		const escaped = escapeInvisibleInJson(json);
		expect(escaped.includes(rlo)).toBe(false);
	});
});
