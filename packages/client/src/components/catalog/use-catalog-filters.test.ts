import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCatalogFilters } from "./use-catalog-filters";

describe("useCatalogFilters", () => {
	it("starts with nothing narrowing the list", () => {
		const { result } = renderHook(() => useCatalogFilters("Mine"));
		expect(result.current.isFiltered).toBe(false);
	});

	it("counts a search as narrowing, but not one of only spaces", () => {
		const { result } = renderHook(() => useCatalogFilters("Mine"));
		act(() => result.current.setSearch("   "));
		expect(result.current.isFiltered).toBe(false);
		act(() => result.current.setSearch("bot"));
		expect(result.current.isFiltered).toBe(true);
	});

	it("counts a metadata filter as narrowing", () => {
		const { result } = renderHook(() => useCatalogFilters("Discoverable"));
		act(() => result.current.setMetaFilters({ tag: ["a"] }));
		expect(result.current.isFiltered).toBe(true);
	});

	it("applies the access filters to the Mine tab only", () => {
		const { result, rerender } = renderHook(
			({ tab }) => useCatalogFilters(tab),
			{ initialProps: { tab: "Mine" } },
		);
		act(() => result.current.setAccess(["OWNER"]));
		expect(result.current.isFiltered).toBe(true);
		rerender({ tab: "Discoverable" });
		expect(result.current.isFiltered).toBe(false);
	});

	it("clears the search and every filter, with a stable function", () => {
		const { result } = renderHook(() => useCatalogFilters("Mine"));
		const clear = result.current.clearFilters;
		act(() => {
			result.current.setSearch("bot");
			result.current.setMetaFilters({ tag: ["a"] });
			result.current.setAccess(["OWNER"]);
		});
		expect(result.current.isFiltered).toBe(true);
		act(() => result.current.clearFilters());
		expect(result.current.search).toBe("");
		expect(result.current.metaFilters).toEqual({});
		expect(result.current.access).toEqual([]);
		expect(result.current.isFiltered).toBe(false);
		expect(result.current.clearFilters).toBe(clear);
	});
});
