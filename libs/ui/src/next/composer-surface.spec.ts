import { describe, expect, it } from "vitest";
import { composerSurfaceClass } from "./composer-surface";

const RAW_PALETTE =
	/-(red|green|blue|gray|slate|zinc|neutral|amber|yellow|orange|purple|violet|pink|rose|teal|cyan|sky|indigo|emerald|lime)-\d/;

describe("composerSurfaceClass", () => {
	it.each([
		"rounded-lg",
		"border-border",
		"bg-card",
		"focus-within:border-ring",
		"focus-within:ring-2",
	])("has %s", (cls) => {
		expect(composerSurfaceClass.split(" ")).toContain(cls);
	});

	it("is a flat surface at the panel radius", () => {
		expect(composerSurfaceClass).not.toContain("shadow");
		expect(composerSurfaceClass).not.toContain("rounded-2xl");
		expect(composerSurfaceClass).not.toContain("rounded-md");
	});

	it("uses only semantic tokens", () => {
		expect(composerSurfaceClass).not.toMatch(RAW_PALETTE);
		expect(composerSurfaceClass).not.toContain("[#");
	});
});
