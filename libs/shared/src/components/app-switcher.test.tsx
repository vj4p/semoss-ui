import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { APP_SWITCHER_APPS, AppSwitcher, appHref } from "./app-switcher";

afterEach(cleanup);

describe("appHref", () => {
	it("swaps the app directory in a deployed path", () => {
		expect(appHref("/packages/client/dist/", "harness")).toBe(
			"/packages/harness/dist/",
		);
	});

	it("keeps a context path in front", () => {
		expect(appHref("/semoss/packages/code/dist/index.html", "client")).toBe(
			"/semoss/packages/client/dist/",
		);
	});

	it("falls back to a sibling-relative link outside a deployed path", () => {
		expect(appHref("/", "terminal")).toBe("../../terminal/dist/");
	});
});

const open = () =>
	fireEvent.keyDown(screen.getByRole("button", { name: "Apps" }), {
		key: "Enter",
	});

describe("AppSwitcher", () => {
	it("lists every app as a link to its own bundle", () => {
		render(
			<AppSwitcher
				current="harness"
				pathname="/packages/harness/dist/"
				embedded={false}
			/>,
		);
		open();
		for (const app of APP_SWITCHER_APPS) {
			const link = screen.getByRole("menuitem", {
				name: new RegExp(app.name),
			});
			expect(link.getAttribute("href")).toBe(
				`/packages/${app.dir}/dist/`,
			);
		}
	});

	it("marks the current app", () => {
		render(
			<AppSwitcher
				current="code"
				pathname="/packages/code/dist/"
				embedded={false}
			/>,
		);
		open();
		expect(
			screen
				.getByRole("menuitem", { name: /Code/ })
				.getAttribute("aria-current"),
		).toBe("page");
		expect(
			screen
				.getByRole("menuitem", { name: /Harness/ })
				.getAttribute("aria-current"),
		).toBeNull();
	});

	it("renders nothing when the page is embedded", () => {
		const { container } = render(<AppSwitcher current="client" embedded />);
		expect(container.firstChild).toBeNull();
	});

	it("uses the labels it is given", () => {
		render(
			<AppSwitcher
				current="client"
				pathname="/"
				embedded={false}
				labels={{ trigger: "Aplicaciones" }}
			/>,
		);
		expect(
			screen.getByRole("button", { name: "Aplicaciones" }),
		).toBeTruthy();
	});
});
