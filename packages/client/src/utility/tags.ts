import type { CSSProperties } from "react";
import { hashString as hashTag } from "@semoss/utility/text";

interface TagColorPalette {
	backgroundColor: string;
	color: string;
	borderColor: string;
}

const FALLBACK_TAG_PALETTE: TagColorPalette = {
	backgroundColor: "var(--color-background-secondary)",
	color: "var(--color-text-secondary)",
	borderColor: "var(--color-border-tertiary)",
};

const tagPaletteCache = new Map<string, TagColorPalette>();

export const normalizeTagArray = (tag?: string[] | string): string[] => {
	if (tag === undefined) return [];
	if (Array.isArray(tag)) return tag.filter(Boolean);
	return tag !== "" ? [tag] : [];
};

const normalizeTagKey = (tag: string): string => {
	return tag.trim().toLowerCase().replace(/\s+/g, " ");
};

/** One color for light and one for dark; the page's `color-scheme` picks. */
const lightDark = (light: string, dark: string): string =>
	`light-dark(${light}, ${dark})`;

const createTagPalette = (tag: string): TagColorPalette => {
	const hash = hashTag(tag);
	const hue = hash % 360;
	const saturation = 44 + (hash % 24);
	const textSaturation = Math.max(32, saturation - 12);
	const backgroundLightness = 90 + ((hash >> 8) % 6);
	const borderLightness = 74 + ((hash >> 14) % 10);
	const textLightness = 22 + ((hash >> 20) % 10);

	// Dark mode keeps the tag's hue on a dark fill with light text, so the
	// chip reads as a tinted label and not a pale patch on a dark page.
	return {
		backgroundColor: lightDark(
			`hsl(${hue} ${saturation}% ${backgroundLightness}%)`,
			`hsl(${hue} ${Math.round(saturation * 0.55)}% ${14 + ((hash >> 8) % 5)}%)`,
		),
		color: lightDark(
			`hsl(${hue} ${textSaturation}% ${textLightness}%)`,
			`hsl(${hue} ${Math.min(80, textSaturation + 20)}% ${78 + ((hash >> 20) % 8)}%)`,
		),
		borderColor: lightDark(
			`hsl(${hue} ${textSaturation}% ${borderLightness}%)`,
			`hsl(${hue} ${Math.round(textSaturation * 0.6)}% ${30 + ((hash >> 14) % 8)}%)`,
		),
	};
};

export const getTagColorPalette = (tag: string): TagColorPalette => {
	const normalizedTag = normalizeTagKey(tag);
	if (!normalizedTag) {
		return FALLBACK_TAG_PALETTE;
	}

	const cachedPalette = tagPaletteCache.get(normalizedTag);
	if (cachedPalette) {
		return cachedPalette;
	}

	const palette = createTagPalette(normalizedTag);
	tagPaletteCache.set(normalizedTag, palette);

	return palette;
};

export const getTagBadgeStyle = (tag: string): CSSProperties => {
	const palette = getTagColorPalette(tag);

	return {
		backgroundColor: palette.backgroundColor,
		color: palette.color,
		border: `1px solid ${palette.borderColor}`,
	};
};
