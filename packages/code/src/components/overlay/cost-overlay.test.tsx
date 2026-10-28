import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { summarizeCost } from "@/api/cost-summary";
import { CostOverlay } from "./cost-overlay";
import { overlayI18n, renderOverlay } from "./render-overlay";

const getRoomCost = vi.fn();
vi.mock("@/api/room-data", () => ({
	getRoomCost: (...args: unknown[]) => getRoomCost(...args),
}));

const usage = (models: Array<Record<string, unknown>>) =>
	summarizeCost({ models, totals: { currency: "USD" } });

const model = (over: Record<string, unknown> = {}) => ({
	modelName: "Model One",
	llmCalls: 2,
	inputTokens: 1000,
	outputTokens: 500,
	priced: true,
	cost: 0.5,
	...over,
});

/** Open the overlay on a room, or with `{ room: false }` before any room exists. */
const open = ({ room = true }: { room?: boolean } = {}) =>
	renderOverlay(
		<CostOverlay
			open
			onDismiss={vi.fn()}
			roomId={room ? "room-1" : undefined}
			insightId="insight-1"
		/>,
	);

beforeAll(async () => {
	await overlayI18n.ready;
});

afterEach(() => {
	getRoomCost.mockReset();
});

describe("CostOverlay", () => {
	it("says there is no usage when there is no room", async () => {
		open({ room: false });
		expect(await screen.findByText("No usage data yet")).toBeTruthy();
		expect(getRoomCost).not.toHaveBeenCalled();
	});

	it("totals a fully priced room in money and tokens", async () => {
		getRoomCost.mockResolvedValue(usage([model()]));
		open();
		// the total and the one model's row
		expect((await screen.findAllByText("$0.50")).length).toBe(2);
		expect(getRoomCost).toHaveBeenCalledWith("room-1", "insight-1");
		expect(
			screen.getByText("Costs are estimates", { exact: false }),
		).toBeTruthy();
	});

	it("shows a model with no published price as No price, never as $0.00", async () => {
		getRoomCost.mockResolvedValue(
			usage([model({ priced: false, cost: undefined })]),
		);
		open();
		expect((await screen.findAllByText("No price")).length).toBeGreaterThan(
			1,
		);
		expect(screen.queryByText("$0.00")).toBeNull();
		expect(
			screen.getByText("its cost is unknown, not zero", { exact: false }),
		).toBeTruthy();
	});

	it("marks a total that leaves a model out as a minimum", async () => {
		getRoomCost.mockResolvedValue(
			usage([
				model(),
				model({
					modelName: "Model Two",
					priced: false,
					cost: undefined,
				}),
			]),
		);
		open();
		expect(await screen.findByText("$0.50+")).toBeTruthy();
		expect(screen.getByText("No price for 1 of 2 models.")).toBeTruthy();
	});

	it("shows a failure as an alert and retries", async () => {
		getRoomCost
			.mockRejectedValueOnce(new Error("Not allowed"))
			.mockResolvedValueOnce(usage([model()]));
		open();
		const alert = await screen.findByRole("alert");
		fireEvent.click(
			within(alert).getByRole("button", { name: "Try again" }),
		);
		expect((await screen.findAllByText("$0.50")).length).toBe(2);
	});
});
