import { describe, expect, it } from "vitest";
import {
	buildCatalogPixel,
	isAgentFilter,
	isSortOption,
	toCardPermission,
} from "./workspace-catalog";

describe("buildCatalogPixel", () => {
	it("lists every workspace agent with no filter or search", () => {
		expect(buildCatalogPixel([], "", "name", 25, 0)).toBe(
			'META | MyProjects(projectType=["WORKSPACE"], sort=[{"PROJECTNAME": "ASC"}], limit=[25], offset=[0])',
		);
	});

	it("encodes what the user typed so quotes cannot break the pixel", () => {
		const pixel = buildCatalogPixel([], 'a"b', "name", 25, 0);
		expect(pixel).toContain('filterWord=["<encode>a"b</encode>"], ');
	});

	it("maps each access filter to its permission level", () => {
		expect(buildCatalogPixel(["owner"], "", "name", 25, 0)).toContain(
			"effectivePermissions=[1], ",
		);
		expect(
			buildCatalogPixel(["owner", "edit", "view"], "", "name", 25, 0),
		).toContain("effectivePermissions=[1,2,3], ");
	});

	it("narrows to the user's own agents for Created by Me, without a permission filter", () => {
		const pixel = buildCatalogPixel(["createdByMe"], "", "name", 25, 0);
		expect(pixel).toContain("createdByMe=[true], ");
		expect(pixel).not.toContain("effectivePermissions");
	});

	it("combines Created by Me with an access filter", () => {
		const pixel = buildCatalogPixel(
			["createdByMe", "edit"],
			"",
			"name",
			25,
			0,
		);
		expect(pixel).toContain("effectivePermissions=[2], ");
		expect(pixel).toContain("createdByMe=[true], ");
	});

	it.each([
		["name", '{"PROJECTNAME": "ASC"}'],
		["newest", '{"DATECREATED": "DESC"}'],
		["edited", '{"DATELASTEDITED": "DESC"}'],
	] as const)("sorts by %s", (sort, expected) => {
		expect(buildCatalogPixel([], "", sort, 25, 0)).toContain(
			`sort=[${expected}]`,
		);
	});

	it("pages with the given limit and offset", () => {
		const pixel = buildCatalogPixel([], "", "name", 10, 30);
		expect(pixel).toContain("limit=[10], offset=[30]");
	});
});

describe("toCardPermission", () => {
	it.each([
		[1, "OWNER"],
		[2, "EDIT"],
		[3, "READ_ONLY"],
	] as const)("reads effective level %s as %s", (level, expected) => {
		expect(
			toCardPermission({ permission: level, user_permission: 3 }),
		).toBe(expected);
	});

	it("prefers the effective permission over the user's own grant", () => {
		expect(toCardPermission({ permission: 1, user_permission: 3 })).toBe(
			"OWNER",
		);
	});

	it("falls back to the user's own grant when there is no effective permission", () => {
		expect(toCardPermission({ permission: null, user_permission: 2 })).toBe(
			"EDIT",
		);
		expect(toCardPermission({ user_permission: 1 })).toBe("OWNER");
	});

	it("treats an unknown level as read only", () => {
		expect(toCardPermission({ user_permission: 99 })).toBe("READ_ONLY");
	});
});

describe("control value guards", () => {
	it("accepts only the filters and orderings offered", () => {
		expect(isAgentFilter("createdByMe")).toBe(true);
		expect(isAgentFilter("everything")).toBe(false);
		expect(isSortOption("newest")).toBe(true);
		expect(isSortOption("random")).toBe(false);
	});

	it("does not treat an inherited object key as an ordering", () => {
		expect(isSortOption("toString")).toBe(false);
	});
});
