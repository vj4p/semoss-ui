import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useState,
} from "react";
import type { CatalogAccessFilter } from "@/utility/catalog";

/** What a catalog's search and filters hold, with what to do about them. */
export interface CatalogFilters {
	/** What the user typed in the search box */
	search: string;
	/** Replaces the search text */
	setSearch: Dispatch<SetStateAction<string>>;
	/** The chosen metadata filters, by key */
	metaFilters: Record<string, unknown>;
	/** Replaces the metadata filters */
	setMetaFilters: Dispatch<SetStateAction<Record<string, unknown>>>;
	/** The chosen access filters; they apply to the user's own list only */
	access: CatalogAccessFilter[];
	/** Replaces the access filters */
	setAccess: Dispatch<SetStateAction<CatalogAccessFilter[]>>;
	/** A search or a filter is narrowing what the catalog lists */
	isFiltered: boolean;
	/** Clear the search and every filter */
	clearFilters: () => void;
}

/**
 * Own a catalog's search text and filters, and say whether they are narrowing
 * the list, so an empty list can be told apart from a filtered-empty one.
 *
 * @param tab - The tab being shown; the access filters narrow only "Mine".
 * @returns The filter state, its setters, `isFiltered` and `clearFilters`.
 */
export const useCatalogFilters = (tab: string): CatalogFilters => {
	const [search, setSearch] = useState("");
	const [metaFilters, setMetaFilters] = useState<Record<string, unknown>>({});
	const [access, setAccess] = useState<CatalogAccessFilter[]>([]);

	const isFiltered =
		search.trim() !== "" ||
		Object.keys(metaFilters).length > 0 ||
		(tab === "Mine" && access.length > 0);

	const clearFilters = useCallback(() => {
		setSearch("");
		setMetaFilters({});
		setAccess([]);
	}, []);

	return {
		search,
		setSearch,
		metaFilters,
		setMetaFilters,
		access,
		setAccess,
		isFiltered,
		clearFilters,
	};
};
