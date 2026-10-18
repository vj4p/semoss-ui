import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	PLATFORM_LEGACY_THEME_KEYS,
	PLATFORM_THEME_STORAGE_KEY,
	ThemeProvider,
	useTheme,
} from "./theme-provider";

const Probe = () => {
	const { theme, setTheme } = useTheme();
	return (
		<button type="button" onClick={() => setTheme("dark")}>
			{theme}
		</button>
	);
};

const renderProbe = (defaultTheme: "light" | "dark" | "system" = "system") =>
	render(
		<ThemeProvider
			defaultTheme={defaultTheme}
			storageKey={PLATFORM_THEME_STORAGE_KEY}
			legacyStorageKeys={PLATFORM_LEGACY_THEME_KEYS}
		>
			<Probe />
		</ThemeProvider>,
	);

beforeEach(() => {
	window.matchMedia = ((query: string) => ({
		matches: true,
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		onchange: null,
		dispatchEvent: () => false,
	})) as typeof window.matchMedia;
	localStorage.clear();
	document.documentElement.className = "";
});

afterEach(cleanup);

describe("one theme across the platform", () => {
	it("uses the shared key's value", () => {
		localStorage.setItem(PLATFORM_THEME_STORAGE_KEY, "light");
		const { container } = renderProbe();
		expect(container.textContent).toBe("light");
	});

	it("adopts a choice an app stored under its old key, and saves it under the shared key", () => {
		localStorage.setItem("smss-ui-theme-client", "light");
		const { container } = renderProbe();
		expect(container.textContent).toBe("light");
		expect(localStorage.getItem(PLATFORM_THEME_STORAGE_KEY)).toBe("light");
	});

	it("prefers the shared key over any old key", () => {
		localStorage.setItem(PLATFORM_THEME_STORAGE_KEY, "dark");
		localStorage.setItem("smss-ui-theme-client", "light");
		const { container } = renderProbe();
		expect(container.textContent).toBe("dark");
	});

	it("lets the client's old choice win over another app's", () => {
		localStorage.setItem("smss-ui-theme-harness", "dark");
		localStorage.setItem("smss-ui-theme-client", "light");
		const { container } = renderProbe();
		expect(container.textContent).toBe("light");
	});

	it("ignores a stored value that is not a theme", () => {
		localStorage.setItem(PLATFORM_THEME_STORAGE_KEY, "purple");
		const { container } = renderProbe("light");
		expect(container.textContent).toBe("light");
	});

	it("keeps the default when nothing is stored", () => {
		const { container } = renderProbe("system");
		expect(container.textContent).toBe("system");
		expect(localStorage.getItem(PLATFORM_THEME_STORAGE_KEY)).toBeNull();
	});

	it("follows a change made in another tab or frame", () => {
		const { container } = renderProbe("light");
		act(() => {
			window.dispatchEvent(
				new StorageEvent("storage", {
					key: PLATFORM_THEME_STORAGE_KEY,
					newValue: "dark",
				}),
			);
		});
		expect(container.textContent).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});

	it("ignores storage changes to other keys", () => {
		const { container } = renderProbe("light");
		act(() => {
			window.dispatchEvent(
				new StorageEvent("storage", {
					key: "unrelated",
					newValue: "dark",
				}),
			);
		});
		expect(container.textContent).toBe("light");
	});

	it("saves a choice under the shared key", () => {
		const { getByRole } = renderProbe("light");
		act(() => {
			getByRole("button").click();
		});
		expect(localStorage.getItem(PLATFORM_THEME_STORAGE_KEY)).toBe("dark");
	});
});
