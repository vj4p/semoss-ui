import { describe, expect, it, vi } from "vitest";
import type { RoomSettings } from "@semoss/agent-core";
import { createSessionBackend } from "./session-backend";

const createRoom = vi.fn();
vi.mock("@/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/api")>();
	return {
		...actual,
		createRoom: (...args: unknown[]) => createRoom(...args),
	};
});

const SETTINGS: RoomSettings = { harness: "claude_code", modelId: "model-1" };

describe("createSessionBackend", () => {
	describe("createRoom", () => {
		it("tells onInsightBound the insight the new room was bound to", async () => {
			createRoom.mockResolvedValue({
				roomId: "room-new",
				insightId: "insight-new",
			});
			const onInsightBound = vi.fn();
			const backend = createSessionBackend(undefined, onInsightBound);

			const roomId = await backend.createRoom(SETTINGS);

			expect(roomId).toBe("room-new");
			// This is what use-console-session.ts relies on to update the
			// :mcp overlay's insightId once a session that started with no
			// room creates one: without this call, that overlay prop stays
			// undefined for the rest of the session (the regression this
			// callback exists to fix).
			expect(onInsightBound).toHaveBeenCalledWith("insight-new");
		});

		it("binds the backend's own insight too, so a later call needing it succeeds", async () => {
			createRoom.mockResolvedValue({
				roomId: "room-new",
				insightId: "insight-new",
			});
			const backend = createSessionBackend();

			await backend.createRoom(SETTINGS);

			const agent = backend.followRun?.({
				runId: "fresh-insight-run",
				roomId: "fresh-insight-room",
			});
			expect(agent).toMatchObject({ insightId: "insight-new" });
		});
	});

	describe("followRun", () => {
		it("gives a store for the run, in the insight the room is bound to", () => {
			const agent = createSessionBackend("insight-1").followRun?.({
				runId: "child-run-1",
				roomId: "child-room-1",
			});

			expect(agent).toMatchObject({
				roomId: "child-room-1",
				insightId: "insight-1",
				runId: "child-run-1",
			});
		});

		it("gives the store already in the registry for a run it has", () => {
			const backend = createSessionBackend("insight-1");
			const run = { runId: "child-run-2", roomId: "child-room-2" };

			expect(backend.followRun?.(run)).toBe(backend.followRun?.(run));
		});

		it("refuses before the room is bound to an insight", () => {
			expect(() =>
				createSessionBackend().followRun?.({
					runId: "child-run-3",
					roomId: "child-room-3",
				}),
			).toThrow("The room is not bound to an insight");
		});
	});
});
