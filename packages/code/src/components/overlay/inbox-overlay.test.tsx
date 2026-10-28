import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PendingAction } from "@/api/pending-actions";
import { InboxOverlay } from "./inbox-overlay";
import { overlayI18n, renderOverlay } from "./render-overlay";

const getPendingActions = vi.fn();
vi.mock("@/api/room-data", () => ({
	getPendingActions: (...args: unknown[]) => getPendingActions(...args),
}));

const action = (over: Partial<PendingAction> = {}): PendingAction => ({
	id: "a1",
	roomId: "294275c6-5a31-406d-8752-43eeb1937341",
	tool: "Write",
	createdAt: new Date(Date.now() - 7 * 60_000),
	...over,
});

const open = (onDismiss = vi.fn()) => {
	renderOverlay(
		<InboxOverlay open onDismiss={onDismiss} insightId="insight-1" />,
	);
	return onDismiss;
};

beforeAll(async () => {
	await overlayI18n.ready;
});

afterEach(() => {
	getPendingActions.mockReset();
});

describe("InboxOverlay", () => {
	it("says nothing is waiting", async () => {
		getPendingActions.mockResolvedValue([]);
		open();
		expect(await screen.findByText("Nothing waiting on you")).toBeTruthy();
		expect(getPendingActions).toHaveBeenCalledWith("insight-1");
	});

	it("lists what waits, with the tool, how long ago and which room", async () => {
		getPendingActions.mockResolvedValue([action()]);
		open();
		expect(await screen.findByText("Waiting on you (1)")).toBeTruthy();
		const row = screen.getByRole("listitem");
		expect(within(row).getByText("Approve Write")).toBeTruthy();
		expect(within(row).getByText("7m ago · room 294275c6")).toBeTruthy();
	});

	it("words an action with no tool name", async () => {
		getPendingActions.mockResolvedValue([action({ tool: "" })]);
		open();
		expect(await screen.findByText("Approve a tool")).toBeTruthy();
	});

	it("opens the room as a link and closes the overlay", async () => {
		getPendingActions.mockResolvedValue([action()]);
		const onDismiss = open();
		const link = await screen.findByRole("link", { name: "Open room" });
		expect(link.getAttribute("href")).toBe(
			"/room/294275c6-5a31-406d-8752-43eeb1937341",
		);
		fireEvent.click(link);
		expect(onDismiss).toHaveBeenCalled();
	});

	it("shows a failure as an alert and retries", async () => {
		getPendingActions
			.mockRejectedValueOnce(new Error("Sign in again"))
			.mockResolvedValueOnce([]);
		open();
		const alert = await screen.findByRole("alert");
		expect(within(alert).getByText("Sign in again")).toBeTruthy();
		fireEvent.click(
			within(alert).getByRole("button", { name: "Try again" }),
		);
		expect(await screen.findByText("Nothing waiting on you")).toBeTruthy();
	});
});
