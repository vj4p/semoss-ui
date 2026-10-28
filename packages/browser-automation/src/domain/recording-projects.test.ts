import { describe, expect, it } from "vitest";
import { canEditProject } from "./recording-projects";

describe("canEditProject", () => {
	it("accepts owner and edit permission", () => {
		expect(canEditProject(1)).toBe(true);
		expect(canEditProject(2)).toBe(true);
	});

	it("rejects read-only permission", () => {
		expect(canEditProject(3)).toBe(false);
		expect(canEditProject(4)).toBe(false);
	});

	it("rejects a project that comes back with no permission", () => {
		expect(canEditProject(undefined)).toBe(false);
		expect(canEditProject(null)).toBe(false);
		expect(canEditProject("1")).toBe(false);
	});
});
