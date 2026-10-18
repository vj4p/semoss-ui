// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isEmbedded } from "./browser";

describe("isEmbedded without a window", () => {
	it("is false when rendering on a server", () => {
		expect(typeof window).toBe("undefined");
		expect(isEmbedded()).toBe(false);
	});
});
