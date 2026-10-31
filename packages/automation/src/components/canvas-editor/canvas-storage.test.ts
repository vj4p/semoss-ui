// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearDraft,
	readDevMode,
	readDraft,
	writeDevMode,
	writeDraft,
} from "./canvas-storage";

describe("canvas storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("keeps a draft per automation until it is cleared", () => {
		writeDraft("a1", '{"steps":[]}');

		expect(readDraft("a1")).toBe('{"steps":[]}');
		expect(readDraft("a2")).toBeNull();

		clearDraft("a1");

		expect(readDraft("a1")).toBeNull();
	});

	it("remembers dev mode per automation and treats anything but true as off", () => {
		expect(readDevMode("a1")).toBe(false);

		writeDevMode("a1", true);

		expect(readDevMode("a1")).toBe(true);
		expect(readDevMode("a2")).toBe(false);

		writeDevMode("a1", false);

		expect(readDevMode("a1")).toBe(false);
	});

	it("falls back when storage refuses to answer, instead of throwing", () => {
		const refuse = () => {
			throw new DOMException("blocked", "SecurityError");
		};
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(refuse);
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(refuse);
		vi.spyOn(Storage.prototype, "removeItem").mockImplementation(refuse);

		expect(readDraft("a1")).toBeNull();
		expect(readDevMode("a1")).toBe(false);
		expect(() => writeDraft("a1", "{}")).not.toThrow();
		expect(() => writeDevMode("a1", true)).not.toThrow();
		expect(() => clearDraft("a1")).not.toThrow();
	});
});
