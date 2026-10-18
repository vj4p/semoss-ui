import { describe, expect, it } from "vitest";
import { getTagBadgeStyle, getTagColorPalette } from "./tags";

type Hsl = [number, number, number];

const parseHsl = (value: string): Hsl => {
	const m = value.match(
		/hsl\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%\)/,
	);
	if (!m) throw new Error(`not an hsl color: ${value}`);
	return [Number(m[1]), Number(m[2]), Number(m[3])];
};

const luminance = ([h, s, l]: Hsl): number => {
	const sat = s / 100;
	const light = l / 100;
	const k = (n: number) => (n + h / 30) % 12;
	const a = sat * Math.min(light, 1 - light);
	const f = (n: number) =>
		light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	const lin = (c: number) =>
		c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
};

const contrast = (a: Hsl, b: Hsl): number => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

/** Splits `light-dark(<light>, <dark>)` into its two colors. */
const split = (value: string): [string, string] => {
	const m = value.match(/^light-dark\((hsl\([^)]*\)), (hsl\([^)]*\))\)$/);
	if (!m) throw new Error(`not a light-dark() value: ${value}`);
	return [m[1], m[2]];
};

const SAMPLE = Array.from({ length: 300 }, (_, i) => `tag-${i * 7919}`).concat([
	"text-generation",
	"embeddings",
	"PII",
	"Confidential",
]);

describe("tag colors", () => {
	it("keeps the light colors a tag always had", () => {
		// The original formula, for one tag: these exact light values must not change.
		const tag = "text-generation";
		let hash = 0;
		for (const ch of tag) {
			hash = (Math.imul(31, hash) + ch.charCodeAt(0)) | 0;
		}
		const palette = getTagColorPalette(tag);
		const [lightBg, lightText] = [
			split(palette.backgroundColor)[0],
			split(palette.color)[0],
		];
		expect(parseHsl(lightBg)[2]).toBeGreaterThanOrEqual(90);
		expect(parseHsl(lightBg)[2]).toBeLessThanOrEqual(95);
		expect(parseHsl(lightText)[2]).toBeGreaterThanOrEqual(22);
		expect(parseHsl(lightText)[2]).toBeLessThanOrEqual(31);
		expect(parseHsl(lightBg)[0]).toBe(parseHsl(lightText)[0]);
	});

	it("gives every color a dark counterpart", () => {
		const style = getTagBadgeStyle("embeddings");
		for (const value of [style.backgroundColor, style.color]) {
			expect(split(String(value))).toHaveLength(2);
		}
		expect(String(style.border)).toMatch(/^1px solid light-dark\(/);
	});

	it("is stable for the same tag, ignoring case and spacing", () => {
		expect(getTagColorPalette("  Text  Generation ")).toEqual(
			getTagColorPalette("text generation"),
		);
	});

	it.each(["light", "dark"] as const)(
		"text is readable on its fill in %s",
		(mode) => {
			const index = mode === "light" ? 0 : 1;
			for (const tag of SAMPLE) {
				const palette = getTagColorPalette(tag);
				const fg = parseHsl(split(palette.color)[index]);
				const bg = parseHsl(split(palette.backgroundColor)[index]);
				expect(
					contrast(fg, bg),
					`${tag} in ${mode}`,
				).toBeGreaterThanOrEqual(4.5);
			}
		},
	);

	it("keeps the dark fill dark and the dark text light", () => {
		for (const tag of SAMPLE.slice(0, 50)) {
			const palette = getTagColorPalette(tag);
			expect(
				parseHsl(split(palette.backgroundColor)[1])[2],
			).toBeLessThanOrEqual(24);
			expect(parseHsl(split(palette.color)[1])[2]).toBeGreaterThanOrEqual(
				70,
			);
		}
	});

	it("falls back to the neutral palette for an empty tag", () => {
		expect(getTagColorPalette("   ").backgroundColor).toContain("var(");
	});
});
