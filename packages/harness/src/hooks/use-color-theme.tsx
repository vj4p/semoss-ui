import { useCallback, useEffect, useState } from "react";

/**
 * Accent themes defined in styles/color-themes.css. `id` doubles as the class
 * applied to <html> (prefixed), so the two must stay in sync.
 */
export const COLOR_THEMES = [
	{ id: "default", label: "SEMOSS Blue", swatch: "rgb(5, 112, 240)" },
	{ id: "violet", label: "Violet", swatch: "rgb(124, 58, 237)" },
	{ id: "emerald", label: "Emerald", swatch: "rgb(4, 120, 87)" },
	{ id: "amber", label: "Amber", swatch: "rgb(180, 83, 9)" },
	{ id: "rose", label: "Rose", swatch: "rgb(225, 29, 72)" },
	{ id: "slate", label: "Slate", swatch: "rgb(71, 85, 105)" },
] as const;

export type ColorThemeId = (typeof COLOR_THEMES)[number]["id"];

const STORAGE_KEY = "smss-color-theme-harness";
const CLASS_PREFIX = "theme-";
const CHANGE_EVENT = "smss-color-theme-change";
const DEFAULT_THEME: ColorThemeId = "default";

const isColorThemeId = (value: string | null): value is ColorThemeId =>
	!!value && COLOR_THEMES.some((theme) => theme.id === value);

const readStored = (): ColorThemeId => {
	if (typeof window === "undefined") {
		return DEFAULT_THEME;
	}
	const stored = localStorage.getItem(STORAGE_KEY);
	return isColorThemeId(stored) ? stored : DEFAULT_THEME;
};

const applyToDocument = (id: ColorThemeId) => {
	if (typeof document === "undefined") {
		return;
	}
	const root = document.documentElement;
	// Never touch the `light`/`dark` classes ThemeProvider owns — only ours.
	for (const cls of Array.from(root.classList)) {
		if (cls.startsWith(CLASS_PREFIX)) {
			root.classList.remove(cls);
		}
	}
	root.classList.add(`${CLASS_PREFIX}${id}`);
};

/**
 * Applies the stored accent before first paint, so a reload doesn't flash the
 * default accent. Called from main.tsx, outside React.
 */
export const initColorTheme = () => {
	applyToDocument(readStored());
};

/**
 * Read/write the accent theme. Multiple mounted instances stay in sync through
 * a window event, since localStorage's own `storage` event only fires in other
 * tabs.
 */
export const useColorTheme = () => {
	const [colorTheme, setColorThemeState] = useState<ColorThemeId>(readStored);

	useEffect(() => {
		const onChange = (event: Event) => {
			const next = (event as CustomEvent<{ id: ColorThemeId }>).detail
				?.id;
			if (next) {
				setColorThemeState(next);
			}
		};
		window.addEventListener(CHANGE_EVENT, onChange);
		return () => window.removeEventListener(CHANGE_EVENT, onChange);
	}, []);

	const setColorTheme = useCallback((id: ColorThemeId) => {
		if (typeof window !== "undefined") {
			localStorage.setItem(STORAGE_KEY, id);
		}
		applyToDocument(id);
		window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { id } }));
	}, []);

	return { colorTheme, setColorTheme, colorThemes: COLOR_THEMES };
};
