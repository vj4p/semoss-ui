import { describe, expect, it } from "vitest";
import { getAppCatalogAvatarStyle } from "./icon-utils";

type Rgb = [number, number, number];

/** Convert "hsl(h, s%, l%)" to sRGB channels in 0..1. */
const hslToRgb = (value: string): Rgb => {
	const match = value.match(/^hsl\((\d+), (\d+)%, (\d+)%\)$/);
	if (!match) throw new Error(`Cannot parse ${value}`);
	const h = Number(match[1]);
	const s = Number(match[2]) / 100;
	const l = Number(match[3]) / 100;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	const sector = Math.floor(h / 60) % 6;
	const [r, g, b] = [
		[c, x, 0],
		[x, c, 0],
		[0, c, x],
		[0, x, c],
		[x, 0, c],
		[c, 0, x],
	][sector];
	return [r + m, g + m, b + m];
};

const luminance = (rgb: Rgb): number => {
	const [r, g, b] = rgb.map((v) =>
		v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
	);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
	const [hi, lo] = [luminance(hslToRgb(a)), luminance(hslToRgb(b))].sort(
		(x, y) => y - x,
	);
	return (hi + 0.05) / (lo + 0.05);
};

describe("getAppCatalogAvatarStyle", () => {
	it("keeps the initials readable (4.5:1) on every hue the name hash can pick", () => {
		// the hue is the name's hash modulo 360, so every hue is reachable
		const hues = Array.from({ length: 360 }, (_, i) => i);
		const worst = Math.min(
			...hues.map((hue) => {
				// find a label-independent style by stubbing the hue through the format
				const style = {
					backgroundColor: `hsl(${hue}, 22%, 72%)`,
					color: `hsl(${hue}, 28%, 22%)`,
				};
				return contrast(style.color, style.backgroundColor);
			}),
		);
		expect(worst).toBeGreaterThanOrEqual(4.5);
	});

	it("uses the lightness the readability check covers", () => {
		const style = getAppCatalogAvatarStyle("App Building Agent");
		expect(style.backgroundColor).toMatch(/, 22%, 72%\)$/);
		expect(style.color).toMatch(/, 28%, 22%\)$/);
	});
});
