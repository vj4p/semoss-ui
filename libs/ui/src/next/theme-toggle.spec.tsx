import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

const STORAGE_KEY = "theme-toggle-spec";

beforeEach(() => {
	window.matchMedia = ((query: string) => ({
		matches: false,
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

/** Radix menus open on Enter, which works without pointer events in jsdom. */
const openMenu = () => {
	fireEvent.keyDown(screen.getByRole("button", { name: "Theme" }), {
		key: "Enter",
	});
};

const renderToggle = (defaultTheme: "light" | "dark" | "system" = "light") =>
	render(
		<ThemeProvider defaultTheme={defaultTheme} storageKey={STORAGE_KEY}>
			<ThemeToggle />
		</ThemeProvider>,
	);

describe("ThemeToggle", () => {
	it("names its trigger and offers light, dark and system", () => {
		renderToggle();
		openMenu();
		expect(
			screen.getByRole("menuitemradio", { name: "Light" }),
		).toBeTruthy();
		expect(
			screen.getByRole("menuitemradio", { name: "Dark" }),
		).toBeTruthy();
		expect(
			screen.getByRole("menuitemradio", { name: "System" }),
		).toBeTruthy();
	});

	it("marks the active theme as checked", () => {
		renderToggle("light");
		openMenu();
		expect(
			screen
				.getByRole("menuitemradio", { name: "Light" })
				.getAttribute("aria-checked"),
		).toBe("true");
		expect(
			screen
				.getByRole("menuitemradio", { name: "Dark" })
				.getAttribute("aria-checked"),
		).toBe("false");
	});

	it("applies and stores the dark theme when Dark is chosen", () => {
		renderToggle("light");
		openMenu();
		fireEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
	});

	it("uses the labels it is given", () => {
		render(
			<ThemeProvider defaultTheme="light" storageKey={STORAGE_KEY}>
				<ThemeToggle
					labels={{
						trigger: "Apariencia",
						light: "Claro",
						dark: "Oscuro",
						system: "Sistema",
					}}
				/>
			</ThemeProvider>,
		);
		fireEvent.keyDown(screen.getByRole("button", { name: "Apariencia" }), {
			key: "Enter",
		});
		expect(
			screen.getByRole("menuitemradio", { name: "Oscuro" }),
		).toBeTruthy();
	});
});
