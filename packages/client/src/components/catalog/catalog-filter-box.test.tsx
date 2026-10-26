import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogFilterBox } from "./catalog-filter-box";

const mocks = vi.hoisted(() => ({ values: [] as unknown[] }));

vi.mock("@semoss/sdk/react", () => ({
	usePixel: () => ({ status: "SUCCESS", data: mocks.values }),
}));

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

vi.mock("@/hooks", () => ({
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
		const pill = screen.getByTestId("filterbox-Confidential-filterBtn");
		expect(pill).toHaveTextContent("Confidential4");
		expect(
			screen.getByTestId("filterbox-Public-filterBtn"),
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
			screen.getByTestId("filterbox-text-generation-filterBtn"),
		).toBeVisible();
		expect(
			screen.getByTestId("filterbox-Confidential-filterBtn"),
		).toBeVisible();
		expect(
			screen.queryByTestId("filterbox-PHI Allowed-filterBtn"),
		).toBeNull();
	});
});
