import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RoomRun } from "@/api/room-runs";
import { overlayI18n, renderOverlay } from "./render-overlay";
import { RunsOverlay } from "./runs-overlay";

const getRoomRuns = vi.fn();
vi.mock("@/api/room-data", () => ({
	getRoomRuns: (...args: unknown[]) => getRoomRuns(...args),
}));

const run = (over: Partial<RoomRun>): RoomRun => ({
	id: "r1",
	prompt: "build it",
	status: "COMPLETED",
	startedAt: new Date(Date.now() - 5 * 60_000),
	durationMs: 23_600,
	...over,
});

/** Open the overlay on a room, or with `{ room: false }` before any room exists. */
const open = ({ room = true }: { room?: boolean } = {}) =>
	renderOverlay(
		<RunsOverlay
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
	getRoomRuns.mockReset();
});

describe("RunsOverlay", () => {
	it("says nothing has run when there is no room, and reads nothing", async () => {
		open({ room: false });
		expect(await screen.findByText("No runs yet")).toBeTruthy();
		expect(getRoomRuns).not.toHaveBeenCalled();
	});

	it("reads the room's runs in its insight and lists them with status, time and duration", async () => {
		getRoomRuns.mockResolvedValue([
			run({ id: "a", prompt: "first" }),
			run({
				id: "b",
				prompt: "second",
				status: "FAILED",
				durationMs: undefined,
			}),
		]);
		open();
		expect(await screen.findByText("Run history (2 total)")).toBeTruthy();
		expect(getRoomRuns).toHaveBeenCalledWith("room-1", "insight-1");
		const items = screen.getAllByRole("listitem");
		expect(within(items[0]).getByText("first")).toBeTruthy();
		expect(within(items[0]).getByText("5m ago")).toBeTruthy();
		expect(within(items[0]).getByText("23.6s")).toBeTruthy();
		expect(within(items[1]).getByText("Failed")).toBeTruthy();
		// a run with no end has no duration, not a made-up one
		expect(within(items[1]).queryByText(/\ds$/)).toBeNull();
	});

	it("cuts a long prompt and words a missing one", async () => {
		getRoomRuns.mockResolvedValue([
			run({ id: "a", prompt: "x".repeat(150) }),
			run({ id: "b", prompt: "" }),
		]);
		open();
		expect(await screen.findByText(`${"x".repeat(100)}…`)).toBeTruthy();
		expect(screen.getByText("(empty prompt)")).toBeTruthy();
	});

	it("shows a failure as an alert and retries", async () => {
		getRoomRuns
			.mockRejectedValueOnce(new Error("Not allowed"))
			.mockResolvedValueOnce([run({ id: "a" })]);
		open();
		const alert = await screen.findByRole("alert");
		expect(within(alert).getByText("Not allowed")).toBeTruthy();
		fireEvent.click(
			within(alert).getByRole("button", { name: "Try again" }),
		);
		expect(await screen.findByText("Run history (1 total)")).toBeTruthy();
	});
});
