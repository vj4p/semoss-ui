import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Tests run from `libs/ui` (`pnpm test`); jsdom gives `import.meta.url` a non-file scheme. */
const css = readFileSync(join(process.cwd(), "src/styles/globals.css"), "utf8");

/** Reads the custom properties declared in the first `<selector> {` block. */
const readBlock = (selector: string): Record<string, string> => {
	const start = css.indexOf(`${selector} {`);
	if (start < 0) throw new Error(`No ${selector} block in globals.css`);
	const body = css.slice(start, css.indexOf("}", start));
	const tokens: Record<string, string> = {};
	for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
		tokens[match[1]] = match[2].trim();
	}
	return tokens;
};

type Rgb = [number, number, number];

const parseColor = (value: string): Rgb => {
	const hex = value.match(/^#([0-9a-f]{6})$/i);
	if (hex) {
		const n = Number.parseInt(hex[1], 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}
	const rgba = value.match(
		/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\s*\)$/,
	);
	if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
	throw new Error(`Cannot parse color "${value}"`);
};

const channel = (c: number): number => {
	const s = c / 255;
	return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: Rgb): number =>
	0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

const contrastOfRgb = (a: Rgb, b: Rgb): number => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

const contrast = (a: string, b: string): number =>
	contrastOfRgb(parseColor(a), parseColor(b));

/** The opaque color a `fg` at `alpha` (0..1) paints over `bg`, as Tailwind's `bg-x/10` does. */
const blend = (fg: string, bg: string, alpha: number): Rgb => {
	const top = parseColor(fg);
	const under = parseColor(bg);
	return [0, 1, 2].map((i) =>
		Math.round(alpha * top[i] + (1 - alpha) * under[i]),
	) as Rgb;
};

/** [foreground token, background token, minimum ratio]. 4.5 is text, 3 is a non-text indicator. */
type Pair = [string, string, number];

const surfacePairs = (surface: string): Pair[] => [
	["foreground", surface, 4.5],
	["muted-foreground", surface, 4.5],
	["primary-text", surface, 4.5],
	["success", surface, 4.5],
	["warning", surface, 4.5],
	["destructive", surface, 4.5],
	["info", surface, 4.5],
	["ring", surface, 3],
	// a chart series is a graphical object (WCAG 1.4.11), so 3:1
	["chart-1", surface, 3],
];

const sharedPairs: Pair[] = [
	["muted-foreground", "muted", 4.5],
	["muted-foreground", "canvas", 4.5],
	["foreground", "accent", 4.5],
	["primary-text", "accent", 4.5],
	["primary-text", "canvas", 4.5],
	["primary-text", "muted", 4.5],
	["primary-text", "sidebar", 4.5],
	["primary-foreground", "primary", 4.5],
	["success-foreground", "success", 4.5],
	["warning-foreground", "warning", 4.5],
	["destructive-foreground", "destructive", 4.5],
	["info-foreground", "info", 4.5],
	["success", "success-tint", 4.5],
	["warning", "warning-tint", 4.5],
	["destructive", "destructive-tint", 4.5],
	["info", "info-tint", 4.5],
	["foreground", "sidebar", 4.5],
	["sidebar-accent-foreground", "sidebar-accent", 4.5],
	["sidebar-ring", "sidebar", 3],
	["foreground", "popover", 4.5],
];

describe.each([
	["light", ":root", ["background"]],
	["dark", ".dark", ["background", "card"]],
] as const)("%s theme contrast", (_name, selector, surfaces) => {
	const tokens = readBlock(selector);
	const pairs = [...surfaces.flatMap(surfacePairs), ...sharedPairs];

	it.each(pairs)("%s on %s is at least %s:1", (fg, bg, min) => {
		expect(tokens[fg], `--${fg} is defined`).toBeDefined();
		expect(tokens[bg], `--${bg} is defined`).toBeDefined();
		const ratio = contrast(tokens[fg], tokens[bg]);
		expect(
			ratio,
			`${fg} ${tokens[fg]} on ${bg} ${tokens[bg]}`,
		).toBeGreaterThanOrEqual(min);
	});
});

describe.each([
	["light", ":root"],
	["dark", ".dark"],
] as const)("%s theme primary tint", (_name, selector) => {
	const tokens = readBlock(selector);

	// `bg-primary/10 text-primary-text` is the icon chip and badge idiom
	it.each(["card", "background"])(
		"primary-text on a 10%% primary tint over %s is at least 4.5:1",
		(surface) => {
			const tint = blend(tokens.primary, tokens[surface], 0.1);
			const ratio = contrastOfRgb(
				parseColor(tokens["primary-text"]),
				tint,
			);
			expect(
				ratio,
				`primary-text ${tokens["primary-text"]} on primary/10 over ${surface} ${tokens[surface]}`,
			).toBeGreaterThanOrEqual(4.5);
		},
	);
});

describe("token registration", () => {
	it.each([
		"canvas",
		"primary-text",
		"info",
		"info-foreground",
		"info-tint",
		"success-tint",
		"warning-tint",
		"destructive-tint",
		"destructive-foreground",
	])("exposes --color-%s to Tailwind", (name) => {
		expect(css).toContain(`--color-${name}: var(--${name});`);
	});
});

describe("fonts", () => {
	it("does not load fonts from a third-party CDN", () => {
		expect(css).not.toContain("fonts.googleapis.com");
	});
	it("imports the self-hosted Geist packages", () => {
		expect(css).toContain("@fontsource-variable/geist/wght.css");
		expect(css).toContain("@fontsource-variable/geist-mono/wght.css");
	});
});
