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

/** The hue an avatar style was painted with. */
const hueOf = (backgroundColor: string): number => {
	const match = backgroundColor.match(/^hsl\((\d+),/);
	if (!match) throw new Error(`Cannot parse ${backgroundColor}`);
	return Number(match[1]);
};

/**
 * Ask the real function for a style at every hue by trying labels until each of
 * the 360 hues has come back once.
 */
const stylesByHue = (): Map<
	number,
	ReturnType<typeof getAppCatalogAvatarStyle>
> => {
	const styles = new Map<
		number,
		ReturnType<typeof getAppCatalogAvatarStyle>
	>();
	for (let i = 0; i < 200_000 && styles.size < 360; i++) {
		const style = getAppCatalogAvatarStyle(`app-${i}`);
		const hue = hueOf(style.backgroundColor);
		if (!styles.has(hue)) styles.set(hue, style);
	}
	return styles;
};

describe("getAppCatalogAvatarStyle", () => {
	it("reaches every hue from some label, so the readability check below covers them all", () => {
		expect(stylesByHue().size).toBe(360);
	});

	it("keeps the initials readable (4.5:1) on every hue the name hash can pick", () => {
		const worst = Math.min(
			...[...stylesByHue().values()].map((style) =>
				contrast(style.color, style.backgroundColor),
			),
		);
		expect(worst).toBeGreaterThanOrEqual(4.5);
	});

	it("gives the same label the same style every time", () => {
		expect(getAppCatalogAvatarStyle("App Building Agent")).toEqual(
			getAppCatalogAvatarStyle("App Building Agent"),
		);
	});

	it("treats an empty label as App", () => {
		expect(getAppCatalogAvatarStyle("")).toEqual(
			getAppCatalogAvatarStyle("App"),
		);
	});
});
