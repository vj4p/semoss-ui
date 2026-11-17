import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogFilterBox } from "./catalog-filter-box";

const mocks = vi.hoisted(() => ({ values: [] as unknown[] }));

// one stable object: the component re-runs an effect when this list changes identity
const state = vi.hoisted(() => ({
	config: {
		projectMetaKeys: [],
		databaseMetaKeys: [
			{ metakey: "tag", display_options: "multi-checklist" },
			{
				metakey: "data-classification",
				display_options: "multi-checklist",
				display_values: "Confidential,Public",
			},
			{
				metakey: "data-restrictions",
				display_options: "multi-checklist",
				display_values: "PII Allowed,PHI Allowed",
			},
		],
	},
}));

vi.mock("@semoss/sdk/react", () => ({
	usePixel: () => ({ status: "SUCCESS", data: mocks.values }),
	useConfig: (select: (value: unknown) => unknown) => select(state),
}));

beforeEach(() => {
	// jsdom has no matchMedia; report a desktop viewport so the filters render open
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: true,
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	}));
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
	mocks.values = [];
});

const renderBox = () =>
	render(
		<CatalogFilterBox
			type="MODEL"
			filters={{}}
			onChange={() => undefined}
		/>,
	);

describe("CatalogFilterBox counts", () => {
	it("shows the backend count beside a value from a fixed list", () => {
		mocks.values = [
			{ METAKEY: "tag", METAVALUE: "text-generation", count: 2 },
			{
				METAKEY: "data-classification",
				METAVALUE: "Confidential",
				count: 4,
			},
		];
		renderBox();
		const pill = screen.getByRole("button", {
			name: "Filter by Confidential 4",
		});
		expect(pill).toHaveTextContent("Confidential4");
		expect(
			screen.getByRole("button", { name: "Filter by Public 0" }),
		).toHaveTextContent("Public0");
	});

	it("starts a section collapsed when nothing in it matches", () => {
		mocks.values = [
			{ METAKEY: "tag", METAVALUE: "text-generation", count: 2 },
			{
				METAKEY: "data-classification",
				METAVALUE: "Confidential",
				count: 4,
			},
		];
		renderBox();
		expect(
			screen.getByRole("button", {
				name: "Filter by text-generation 2",
			}),
		).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Filter by Confidential 4" }),
		).toBeVisible();
		expect(
			screen.queryByRole("button", { name: /PHI Allowed/ }),
		).toBeNull();
	});

	it("names each pill with the text it shows, value and count (WCAG 2.5.3)", () => {
		mocks.values = [
			{
				METAKEY: "data-classification",
				METAVALUE: "Confidential",
				count: 4,
			},
		];
		render(
			<CatalogFilterBox
				type="MODEL"
				filters={{ "data-classification": ["Confidential"] }}
				onChange={() => undefined}
			/>,
		);
		const selected = screen.getByRole("button", {
			name: "Remove Confidential 4 filter",
		});
		expect(selected).toHaveAttribute("aria-pressed", "true");
		// the unselected pill shows "Public" then "0", so its name holds "Public 0"
		const unselected = screen.getByRole("button", {
			name: "Filter by Public 0",
		});
		expect(unselected).toHaveAttribute("aria-pressed", "false");
		expect(unselected).toHaveTextContent("Public0");
	});
});
