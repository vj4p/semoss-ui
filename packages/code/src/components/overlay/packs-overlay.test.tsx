import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { CapabilityPack } from "@semoss/agent-core";
import { PacksOverlay } from "./packs-overlay";
import { overlayI18n, renderOverlay } from "./render-overlay";

const getCapabilityPacks = vi.fn();
vi.mock("@/api/room-data", () => ({
	getCapabilityPacks: (...args: unknown[]) => getCapabilityPacks(...args),
}));

const pack = (over: Partial<CapabilityPack> = {}): CapabilityPack =>
	({
		id: "pack-browser",
		label: "Browser",
		description: "Drive a headless browser.",
		toolCount: 11,
		askCount: 3,
		requires: ["MODEL"],
		...over,
	}) as CapabilityPack;

const open = () =>
	renderOverlay(
		<PacksOverlay open onDismiss={vi.fn()} insightId="insight-1" />,
	);

beforeAll(async () => {
	await overlayI18n.ready;
});

afterEach(() => {
	getCapabilityPacks.mockReset();
});

describe("PacksOverlay", () => {
	it("lists each pack with its tools, approvals and the engine it needs", async () => {
		getCapabilityPacks.mockResolvedValue([
			pack(),
			pack({
				id: "pack-data",
				label: "Data",
				askCount: 0,
				requires: ["DATABASE", "VECTOR"],
			}),
		]);
		open();
		expect(
			await screen.findByText("Available capability packs (2 total)"),
		).toBeTruthy();
		const [browser, data] = screen.getAllByRole("listitem");
		expect(
			within(browser).getByRole("heading", { name: "Browser" }),
		).toBeTruthy();
		expect(within(browser).getByText("Tools: 11")).toBeTruthy();
		expect(within(browser).getByText("Need approval: 3")).toBeTruthy();
		// engine kinds are read out as text, not drawn only as an icon
		expect(within(browser).getByText("MODEL")).toBeTruthy();
		expect(within(data).queryByText(/Need approval/)).toBeNull();
		expect(within(data).getByText("DATABASE")).toBeTruthy();
		expect(within(data).getByText("VECTOR")).toBeTruthy();
	});

	it("says there are no packs", async () => {
		getCapabilityPacks.mockResolvedValue([]);
		open();
		expect(
			await screen.findByText("No capability packs available"),
		).toBeTruthy();
	});

	it("shows a failure as an alert and retries", async () => {
		getCapabilityPacks
			.mockRejectedValueOnce(new Error("denied"))
			.mockResolvedValueOnce([pack()]);
		open();
		const alert = await screen.findByRole("alert");
		fireEvent.click(
			within(alert).getByRole("button", { name: "Try again" }),
		);
		expect(
			await screen.findByRole("heading", { name: "Browser" }),
		).toBeTruthy();
	});
});
