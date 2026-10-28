import type { App } from "@/types";

/**
 * The filters offered, in display order. The access filters keep the agents
 * whose effective permission is any of those chosen; Created by Me narrows to
 * the agents the user made, under any of their logins.
 */
export const AGENT_FILTERS = ["createdByMe", "owner", "edit", "view"] as const;
export type AgentFilter = (typeof AGENT_FILTERS)[number];

/** The permission level each access filter keeps. */
const FILTER_PERMISSIONS: Partial<Record<AgentFilter, number>> = {
	owner: 1,
	edit: 2,
	view: 3,
};

/** The orderings offered, in display order. */
export const SORT_OPTION_NAMES = ["name", "newest", "edited"] as const;
export type SortOption = (typeof SORT_OPTION_NAMES)[number];

/** The sort each ordering sends. */
const SORT_OPTIONS: Record<SortOption, string> = {
	name: '{"PROJECTNAME": "ASC"}',
	newest: '{"DATECREATED": "DESC"}',
	edited: '{"DATELASTEDITED": "DESC"}',
};

/** How many agents one page of the list holds. */
export const PAGE_SIZE = 25;

/**
 * Whether a string from a control is one of the filters offered.
 *
 * @param value - The value the control reported.
 * @returns True, narrowing the value to {@link AgentFilter}, when it is one.
 */
export const isAgentFilter = (value: string): value is AgentFilter =>
	AGENT_FILTERS.some((filter) => filter === value);

/**
 * Whether a string from a control is one of the orderings offered. Only the
 * names listed count, not inherited object keys such as `toString`.
 *
 * @param value - The value the control reported.
 * @returns True, narrowing the value to {@link SortOption}, when it is one.
 */
export const isSortOption = (value: string): value is SortOption =>
	SORT_OPTION_NAMES.some((option) => option === value);

/**
 * Build the pixel that lists one page of the user's agents: every agent they
 * can use, narrowed by the chosen filters.
 *
 * @param filters - The chosen filters; none for every agent.
 * @param search - What the user typed; empty for no search.
 * @param sort - The ordering.
 * @param limit - The page size.
 * @param offset - How many agents to skip.
 * @returns The pixel.
 */
export const buildCatalogPixel = (
	filters: readonly AgentFilter[],
	search: string,
	sort: SortOption,
	limit: number,
	offset: number,
): string => {
	const filterWord = search
		? `filterWord=["<encode>${search}</encode>"], `
		: "";
	const permissions = filters.flatMap((filter) => {
		const level = FILTER_PERMISSIONS[filter];
		return level === undefined ? [] : [level];
	});
	const permissionFilter =
		permissions.length > 0
			? `effectivePermissions=${JSON.stringify(permissions)}, `
			: "";
	const createdByMe = filters.includes("createdByMe")
		? "createdByMe=[true], "
		: "";
	return `META | MyProjects(${filterWord}projectType=["WORKSPACE"], ${permissionFilter}${createdByMe}sort=[${SORT_OPTIONS[sort]}], limit=[${limit}], offset=[${offset}])`;
};

/**
 * The user's permission on an agent, as the card shows it. A global agent the
 * user holds no grant on is one they can use but not change.
 *
 * @param app - The agent, as the list returns it.
 * @returns The permission.
 */
export const toCardPermission = (
	app: Pick<App, "permission" | "user_permission">,
): "OWNER" | "EDIT" | "READ_ONLY" => {
	const level = app.permission ?? app.user_permission;
	if (level === 1) return "OWNER";
	if (level === 2) return "EDIT";
	return "READ_ONLY";
};
