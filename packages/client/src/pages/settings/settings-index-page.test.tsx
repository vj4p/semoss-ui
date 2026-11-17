import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsIndexPage } from "./settings-index-page";

const settings = vi.hoisted(() => ({ adminMode: false }));

vi.mock("@/hooks/useSettings", () => ({
	useSettings: () => settings,
}));

// one page that no section lists, to see where such a page lands
vi.mock("./settings.constants", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("./settings.constants")>();
	return {
		...actual,
		SETTINGS_ROUTES: [
			...actual.SETTINGS_ROUTES,
			{
				title: "Unlisted Page",
				path: "unlisted",
				description: "A page no section lists",
				icon: "",
			},
		],
	};
});

afterEach(() => {
	cleanup();
	settings.adminMode = false;
});

/** Render settings navigation with the same router boundary as the application. */
function renderSettings() {
	return render(
		<MemoryRouter>
			<SettingsIndexPage />
		</MemoryRouter>,
	);
}

describe("SettingsIndexPage merged navigation", () => {
	it("keeps My Teams visible without exposing admin audit navigation", () => {
		renderSettings();
		expect(screen.getByRole("link", { name: /My Teams/ })).toHaveAttribute(
			"href",
			"/settings/managed-teams",
		);
		expect(screen.queryByRole("link", { name: /Audit Trail/ })).toBeNull();
		expect(
			screen.queryByRole("link", { name: /Team Permissions/ }),
		).toBeNull();
		expect(screen.queryByRole("link", { name: /Agent Runs/ })).toBeNull();
	});

	it("preserves both audit and team administration links in admin mode", () => {
		settings.adminMode = true;
		renderSettings();
		expect(
			screen.getByRole("link", { name: /Audit Trail/ }),
		).toHaveAttribute("href", "/settings/audit-trail");
		expect(
			screen.getByRole("link", { name: /Team Permissions/ }),
		).toHaveAttribute("href", "/settings/team-permissions");
		expect(
			screen.getByRole("link", { name: /Agent Runs/ }),
		).toHaveAttribute("href", "/settings/agent-runs");
		expect(
			screen.getByRole("link", { name: /My Teams/ }),
		).toBeInTheDocument();
	});

	it("filters and clears the search without losing the merged links", () => {
		settings.adminMode = true;
		renderSettings();
		fireEvent.change(
			screen.getByRole("textbox", { name: "Search settings" }),
			{
				target: { value: "audit" },
			},
		);
		expect(
			screen.getByRole("link", { name: /Audit Trail/ }),
		).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /My Teams/ })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
		expect(
			screen.getByRole("link", { name: /My Teams/ }),
		).toBeInTheDocument();
	});

	it("groups the pages into named sections, each a region under an H3", () => {
		// Resource Governance (which replaced the six per-engine settings pages upstream) is admin-only
		settings.adminMode = true;
		renderSettings();
		const account = screen.getByRole("region", { name: "Account" });
		expect(
			within(account).getByRole("heading", { level: 3, name: "Account" }),
		).toBeInTheDocument();
		for (const page of ["My Profile", "My Files", "My Teams"]) {
			expect(
				within(account).getByRole("link", { name: new RegExp(page) }),
			).toBeInTheDocument();
		}
		const apps = screen.getByRole("region", { name: "Apps and engines" });
		expect(
			within(apps).getByRole("link", { name: /Resource Governance/ }),
		).toBeInTheDocument();
		expect(
			within(account).queryByRole("link", {
				name: /Resource Governance/,
			}),
		).toBeNull();
	});

	it("leaves out a section with nothing to show the user", () => {
		renderSettings();
		expect(screen.queryByRole("region", { name: "Platform" })).toBeNull();
		expect(
			screen.queryByRole("region", { name: "Apps and engines" }),
		).toBeNull();
		expect(
			screen.queryByRole("region", { name: "Monitoring and data" }),
		).toBeNull();
	});

	it("lists admin pages under their section in admin mode", () => {
		settings.adminMode = true;
		renderSettings();
		expect(
			within(screen.getByRole("region", { name: "Platform" })).getByRole(
				"link",
				{ name: /Team Permissions/ },
			),
		).toBeInTheDocument();
		expect(
			within(
				screen.getByRole("region", { name: "Monitoring and data" }),
			).getByRole("link", { name: /Audit Trail/ }),
		).toBeInTheDocument();
	});

	it("puts a page no section lists in More, last", () => {
		renderSettings();
		const regions = screen.getAllByRole("region");
		const last = regions[regions.length - 1];
		expect(last).toBe(screen.getByRole("region", { name: "More" }));
		expect(
			within(last).getByRole("link", { name: /Unlisted Page/ }),
		).toBeInTheDocument();
	});

	it("keeps pages in each section's own order, not the route order", () => {
		renderSettings();
		const names = within(screen.getByRole("region", { name: "Account" }))
			.getAllByRole("link")
			.map((link) => link.textContent ?? "");
		expect(names[0]).toMatch(/^My Profile/);
		expect(names[1]).toMatch(/^My Files/);
		expect(names[2]).toMatch(/^My Teams/);
	});

	it("says nothing matches, as a status, and clears the search from the empty state", () => {
		renderSettings();
		const search = screen.getByRole("textbox", { name: "Search settings" });
		fireEvent.change(search, { target: { value: "zzzz" } });
		const status = screen.getByRole("status");
		expect(
			within(status).getByRole("heading", {
				level: 3,
				name: "No settings match",
			}),
		).toBeInTheDocument();
		expect(status).toHaveTextContent('"zzzz"');
		expect(screen.queryByRole("region")).toBeNull();
		fireEvent.click(
			within(status).getByRole("button", { name: "Clear search" }),
		);
		expect(search).toHaveValue("");
		expect(screen.queryByRole("status")).toBeNull();
		expect(
			screen.getByRole("link", { name: /My Teams/ }),
		).toBeInTheDocument();
	});
});
