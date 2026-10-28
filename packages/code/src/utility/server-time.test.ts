import { describe, expect, it } from "vitest";
import { agoOf, parseServerTime } from "./server-time";

describe("parseServerTime", () => {
	it("reads a zone-less database time as UTC, keeping the milliseconds", () => {
		expect(
			parseServerTime("2026-09-12 03:47:56.368990")?.toISOString(),
		).toBe("2026-09-12T03:47:56.368Z");
	});

	it("reads a time with no fraction", () => {
		expect(parseServerTime("2026-09-12 03:47:56")?.toISOString()).toBe(
			"2026-09-12T03:47:56.000Z",
		);
	});

	it("keeps a zone the value states", () => {
		expect(
			parseServerTime("2026-09-12T03:47:56+02:00")?.toISOString(),
		).toBe("2026-09-12T01:47:56.000Z");
	});

	it("returns nothing for what is not a time", () => {
		expect(parseServerTime(undefined)).toBeUndefined();
		expect(parseServerTime("yesterday")).toBeUndefined();
		expect(parseServerTime(42)).toBeUndefined();
	});
});

describe("agoOf", () => {
	const now = new Date("2026-09-12T12:00:00Z");
	it.each([
		["2026-09-12T11:59:40Z", { unit: "justNow", count: 0 }],
		["2026-09-12T11:55:00Z", { unit: "minutes", count: 5 }],
		["2026-09-12T09:00:00Z", { unit: "hours", count: 3 }],
		["2026-09-10T12:00:00Z", { unit: "days", count: 2 }],
		["2026-09-12T12:00:30Z", { unit: "justNow", count: 0 }],
	])("%s reads as %j", (then, expected) => {
		expect(agoOf(new Date(then), now)).toEqual(expected);
	});
});
