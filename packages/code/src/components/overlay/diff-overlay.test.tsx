import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DiffOverlay } from "./diff-overlay";
import { overlayI18n, renderOverlay } from "./render-overlay";

beforeAll(async () => {
	await overlayI18n.ready;
});

describe("DiffOverlay", () => {
	it("says why there is nothing to compare, and points at :files", () => {
		renderOverlay(<DiffOverlay open onDismiss={vi.fn()} />);
		expect(screen.getByText("No changes to compare")).toBeTruthy();
		expect(screen.getByText("Use :files", { exact: false })).toBeTruthy();
	});
});
