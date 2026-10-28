import { hashString } from "@semoss/utility/text";
import {
	ENGINE_ICON_FALLBACK_FILE,
	ENGINE_IMAGES,
	loadEngineIcon,
} from "../constants/engine-images.constants";

export { buildInitials } from "@semoss/utility/text";

const normalizeEngineKey = (value?: string) =>
	(value || "")
		.trim()
		.replace(/[^A-Za-z0-9]+/g, "_")
		.toUpperCase();

/** The colors an app's initials avatar is painted with. */
export interface AppCatalogAvatarStyle {
	/** A soft fill in the label's hue. */
	backgroundColor: string;
	/** The initials' color, in the same hue and dark enough to read on the fill. */
	color: string;
}

/**
 * Pick the avatar colors for an app, so the same name always gets the same hue.
 * The hue is the label's hash modulo 360, so any hue can be reached; the fixed
 * lightness keeps the initials at 4.5:1 on every one of them.
 *
 * @param label - The app's name; an empty name is treated as "App".
 * @returns The fill and text colors as `hsl()` strings.
 */
export const getAppCatalogAvatarStyle = (
	label: string,
): AppCatalogAvatarStyle => {
	const base = hashString(label || "App") % 360;
	return {
		backgroundColor: `hsl(${base}, 22%, 72%)`,
		color: `hsl(${base}, 28%, 22%)`,
	};
};

export const getEngineSubtypeIcon = async (
	engineType: string,
	engineSubtype?: string,
): Promise<string | null> => {
	const typeKey = normalizeEngineKey(engineType);
	const subtypeKeyRaw = normalizeEngineKey(engineSubtype);
	const subtypeKey =
		subtypeKeyRaw === "GUANACO" ? "HUGGINGFACE" : subtypeKeyRaw;
	const imageOptions = ENGINE_IMAGES[typeKey] || [];

	const match = imageOptions.find(
		(option) => normalizeEngineKey(option.name) === subtypeKey,
	);

	if (match) {
		const resolved = await loadEngineIcon(match.icon);
		if (resolved) return resolved;
	}

	return loadEngineIcon(ENGINE_ICON_FALLBACK_FILE);
};
