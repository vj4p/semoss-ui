import { describe, expect, it, vi } from "vitest";
import type { AgentRunSnapshot, AgentStore } from "@semoss/sdk";
import {
	type AgentWatchHandlers,
	getOrCreateAgent,
	registerAgent,
	watchAgentRun,
} from "./run-registry";

/**
 * A stand-in for AgentStore that lets a test decide when a poll lands.
 *
 * The unit under test is the driver, not the poller: `watchAgentRun` touches
 * exactly `runId`, `watch` and `stop`. Faking those three keeps each assertion
 * about terminal semantics rather than about transport timing, and lets a test
 * deliver a status sequence no real backend would conveniently produce.
 */
const fakeAgent = (runId = "run-1") => {
	let handlers: AgentWatchHandlers | undefined;
	const stop = vi.fn();
	const agent = {
		runId,
		stop,
		watch: (given: AgentWatchHandlers) => {
			handlers = given;
			return { done: Promise.resolve(null) };
		},
	} as unknown as AgentStore;
	return {
		agent,
		stop,
		/** Deliver one reconcile, as AgentStore.watch would. */
		reconcile: (snapshot: Partial<AgentRunSnapshot>) =>
			handlers?.onReconcile({
				runId,
				status: "RUNNING",
				...snapshot,
			} as AgentRunSnapshot),
	};
};

const noopHandlers = (): AgentWatchHandlers => ({
	onEvent: () => undefined,
	onSnapshot: () => undefined,
	onReconcile: () => undefined,
});

describe("watchAgentRun", () => {
	it("resolves with the terminal snapshot on COMPLETED", async () => {
		const { agent, reconcile } = fakeAgent();
		const settled = watchAgentRun(agent, noopHandlers());
		reconcile({ status: "COMPLETED", finalText: "done" });
		await expect(settled).resolves.toMatchObject({ finalText: "done" });
	});

	it("rejects with the backend's own message on FAILED", async () => {
		const { agent, reconcile } = fakeAgent();
		const settled = watchAgentRun(agent, noopHandlers());
		reconcile({
			status: "FAILED",
			errorMessage: "model engine is required",
		});
		await expect(settled).rejects.toThrow("model engine is required");
	});

	it("names the status when the backend gave no message", async () => {
		const { agent, reconcile } = fakeAgent();
		const settled = watchAgentRun(agent, noopHandlers());
		reconcile({ status: "CANCELLED" });
		await expect(settled).rejects.toThrow(
			"The agent run did not complete: CANCELLED",
		);
	});

	/**
	 * INPUT_REQUIRED is the status this has to get right. It reconciles like a
	 * terminal status — that is when pendingActions appear — but polling
	 * continues, so settling here would abandon a run that is merely waiting for
	 * a human and leave the approval UI driving a promise nobody holds.
	 */
	it("does not settle while a run is only waiting for a human", async () => {
		const { agent, reconcile, stop } = fakeAgent();
		let settledWith: string | undefined;
		void watchAgentRun(agent, noopHandlers()).then(
			() => {
				settledWith = "resolved";
			},
			() => {
				settledWith = "rejected";
			},
		);

		reconcile({ status: "INPUT_REQUIRED" });
		await Promise.resolve();

		expect(settledWith).toBeUndefined();
		expect(stop).not.toHaveBeenCalled();
	});

	/**
	 * The handler this driver wraps must still fire on EVERY reconcile, not only
	 * the one that ends the run.
	 *
	 * Non-terminal reconciles are the common case — each INPUT_REQUIRED
	 * transition is one — and they are how the harness learns about pending tool
	 * decisions. A driver that only forwarded the terminal reconcile would leave
	 * every approval prompt unrendered while still passing a suite that checked
	 * resolve/reject alone, which is what an earlier version of these tests did.
	 */
	it("forwards a non-terminal reconcile to the host", () => {
		const { agent, reconcile } = fakeAgent();
		const onReconcile = vi.fn();
		void watchAgentRun(agent, { ...noopHandlers(), onReconcile });
		reconcile({ status: "INPUT_REQUIRED" });
		expect(onReconcile).toHaveBeenCalledTimes(1);
	});

	it("forwards the terminal reconcile on the failure path too", async () => {
		const { agent, reconcile } = fakeAgent();
		const onReconcile = vi.fn();
		const settled = watchAgentRun(agent, {
			...noopHandlers(),
			onReconcile,
		});
		reconcile({ status: "FAILED", errorMessage: "nope" });
		await expect(settled).rejects.toThrow("nope");
		expect(onReconcile).toHaveBeenCalledTimes(1);
	});

	/**
	 * The harness recovers final text from the durable snapshot inside
	 * onReconcile, so anything awaiting this promise must not run first.
	 *
	 * Note what this can and cannot prove. `resolve()` schedules a microtask
	 * rather than running continuations inline, so the driver calling
	 * `onReconcile` after `resolve` would be indistinguishable here — the
	 * observable guarantee is "by the time an awaiter resumes", not a statement
	 * about the order of two synchronous calls.
	 */
	it("has given the host the terminal snapshot before an awaiter resumes", async () => {
		const { agent, reconcile } = fakeAgent();
		const seen: string[] = [];
		const settled = watchAgentRun(agent, {
			...noopHandlers(),
			onReconcile: (snapshot) => seen.push(snapshot.status),
		});
		reconcile({ status: "COMPLETED" });
		await settled;
		expect(seen).toEqual(["COMPLETED"]);
	});

	it("stops polling before it settles, so no later poll can land", async () => {
		const { agent, reconcile, stop } = fakeAgent();
		const settled = watchAgentRun(agent, noopHandlers());
		reconcile({ status: "COMPLETED" });
		await settled;
		expect(stop).toHaveBeenCalledTimes(1);
	});

	it("passes the host's other handlers through untouched", () => {
		const { agent } = fakeAgent();
		const onEvent = vi.fn();
		const onSnapshot = vi.fn();
		const onError = vi.fn();
		const watch = vi.spyOn(agent, "watch");
		void watchAgentRun(agent, {
			onEvent,
			onSnapshot,
			onReconcile: () => undefined,
			onError,
		});
		const given = watch.mock.calls[0]?.[0];
		expect(given?.onEvent).toBe(onEvent);
		expect(given?.onSnapshot).toBe(onSnapshot);
		expect(given?.onError).toBe(onError);
	});

	it("forwards watch options", () => {
		const { agent } = fakeAgent();
		const watch = vi.spyOn(agent, "watch");
		void watchAgentRun(agent, noopHandlers(), { pollIntervalMs: 25 });
		expect(watch.mock.calls[0]?.[1]).toEqual({ pollIntervalMs: 25 });
	});
});

describe("the run registry", () => {
	it("hands back the same store for a run already being watched", () => {
		const first = getOrCreateAgent("room-1", "insight-1", "run-same");
		const second = getOrCreateAgent("room-1", "insight-1", "run-same");
		expect(second).toBe(first);
	});

	/**
	 * Two stores on one run is the failure this registry exists to prevent: the
	 * backend drain is destructive, so a second poller does not duplicate the
	 * feed, it steals half of it.
	 */
	it("keeps a distinct store per run", () => {
		expect(getOrCreateAgent("room-1", "insight-1", "run-a")).not.toBe(
			getOrCreateAgent("room-1", "insight-1", "run-b"),
		);
	});

	it("makes an externally started run reachable", () => {
		const { agent } = fakeAgent("run-started");
		registerAgent(agent);
		expect(getOrCreateAgent("room-1", "insight-1", "run-started")).toBe(
			agent,
		);
	});

	it("releases the run once it settles, so a later turn starts clean", async () => {
		const { agent, reconcile } = fakeAgent("run-released");
		registerAgent(agent);
		const settled = watchAgentRun(agent, noopHandlers());
		reconcile({ status: "COMPLETED" });
		await settled;
		expect(
			getOrCreateAgent("room-1", "insight-1", "run-released"),
		).not.toBe(agent);
	});

	it("releases on failure too, not only on success", async () => {
		const { agent, reconcile } = fakeAgent("run-failed");
		registerAgent(agent);
		const settled = watchAgentRun(agent, noopHandlers());
		reconcile({ status: "FAILED", errorMessage: "nope" });
		await expect(settled).rejects.toThrow("nope");
		expect(getOrCreateAgent("room-1", "insight-1", "run-failed")).not.toBe(
			agent,
		);
	});

	/**
	 * A reconnect can replace the entry for a run while the previous watcher is
	 * still unwinding. Deregistering unconditionally would then evict the LIVE
	 * watcher and hand the next caller a third store.
	 */
	it("does not evict a replacement registered while it was finishing", async () => {
		const { agent, reconcile } = fakeAgent("run-replaced");
		registerAgent(agent);
		const settled = watchAgentRun(agent, noopHandlers());

		const { agent: replacement } = fakeAgent("run-replaced");
		registerAgent(replacement);

		reconcile({ status: "COMPLETED" });
		await settled;

		expect(getOrCreateAgent("room-1", "insight-1", "run-replaced")).toBe(
			replacement,
		);
	});
});
