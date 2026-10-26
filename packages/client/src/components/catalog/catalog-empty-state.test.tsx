import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogEmptyState } from "./catalog-empty-state";

afterEach(cleanup);

describe("CatalogEmptyState", () => {
	it("says a narrowed list matches nothing and clears it on request", () => {
		const onClear = vi.fn();
		render(
			<CatalogEmptyState
				noun="agents"
				filtered
				view="mine"
				onClear={onClear}
			/>,
		);
		expect(screen.getByText("No agents match")).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole("button", { name: "Clear search and filters" }),
		);
		expect(onClear).toHaveBeenCalledOnce();
		expect(screen.queryByRole("button", { name: /Browse/ })).toBeNull();
	});

	it("points an empty My list to the discoverable tab", () => {
		const onBrowse = vi.fn();
		render(
			<CatalogEmptyState
				noun="models"
				filtered={false}
				view="mine"
				onClear={() => undefined}
				onBrowseDiscoverable={onBrowse}
			/>,
		);
		expect(screen.getByText("No models yet")).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole("button", { name: "Browse discoverable models" }),
		);
		expect(onBrowse).toHaveBeenCalledOnce();
	});

	it("offers nothing to click on an empty discoverable list", () => {
		render(
			<CatalogEmptyState
				noun="apps"
				filtered={false}
				view="discoverable"
				onClear={() => undefined}
			/>,
		);
		expect(
			screen.getByText("Nothing discoverable yet"),
		).toBeInTheDocument();
		expect(screen.queryByRole("button")).toBeNull();
	});
});
