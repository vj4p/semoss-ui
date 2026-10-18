import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@semoss/ui/next";
import { LoginShell } from "./login-shell";

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
});

afterEach(cleanup);

const renderShell = (props: Partial<Parameters<typeof LoginShell>[0]> = {}) =>
	render(
		<ThemeProvider defaultTheme="light" storageKey="login-shell-spec">
			<LoginShell brand={<span>Harness</span>} {...props}>
				<form aria-label="Sign in" />
			</LoginShell>
		</ThemeProvider>,
	);

describe("LoginShell", () => {
	it("shows the brand, the form and a theme toggle", () => {
		renderShell();
		expect(screen.getByText("Harness")).toBeTruthy();
		expect(screen.getByRole("form", { name: "Sign in" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Theme" })).toBeTruthy();
	});

	it("shows the hero image it is given", () => {
		const { container } = renderShell({ heroSrc: "/hero.png" });
		expect(container.querySelector("img[src='/hero.png']")).not.toBeNull();
	});

	it("falls back to the default art without a hero image", () => {
		const { container } = renderShell();
		expect(
			container.querySelector("[data-slot='login-art']"),
		).not.toBeNull();
	});

	it("keeps the hero panel off small screens", () => {
		const { container } = renderShell();
		expect(
			container.querySelector("[data-slot='login-hero']")?.className,
		).toContain("hidden");
	});
});
