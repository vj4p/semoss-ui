import { describe, expect, it } from "vitest";
import { createSessionBackend } from "./session-backend";

describe("createSessionBackend", () => {
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
