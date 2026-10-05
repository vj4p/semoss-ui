import {
	decideAgentRunAction,
	getAgentRun,
	pollAgentRun,
	runAgent,
	stopAgentRun,
	streamAgentRun,
} from "../../api/agent";
import type {
	AgentRunItem,
	AgentRunItemEvent,
	AgentRunItemsState,
	AgentRunSnapshot,
	AgentRunStatusValue,
	AgentRunSubscription,
	AgentToolDecision,
	PendingAgentAction,
} from "../../types";

/** Handlers passed to {@link AgentStore.watch}. */
export interface AgentWatchHandlers {
	/** Fires per new item event (deduped, in order), with the items-state already updated. */
	onEvent: (event: AgentRunItemEvent, items: AgentRunItemsState) => void;
	/** Fires on every successful poll with the run's current durable snapshot and the count of events the backend evicted before this drain (`meta.droppedEvents`) — nonzero means the feed has gaps a durable reconcile would fill. */
	onSnapshot: (
		snapshot: AgentRunSnapshot,
		meta: { droppedEvents: number },
	) => void;
	/** Fires once per transition into INPUT_REQUIRED or a terminal status, with persisted messages included. Polling continues after INPUT_REQUIRED; stops after a terminal status. */
	onReconcile: (
		snapshot: AgentRunSnapshot & { messages?: Record<string, unknown>[] },
	) => void;
	/** A transport error on one poll. Non-fatal — polling keeps retrying with backoff until the consecutive-failure cap. */
	onError?: (error: Error) => void;
}

/** Options passed to {@link AgentStore.watch}. */
export interface AgentWatchOptions {
	/** Base delay between polls in ms. Defaults to 500. Ignored when `transport` is "sse". */
	pollIntervalMs?: number;
	/** Multiplier on pollIntervalMs while INPUT_REQUIRED. Defaults to 3. Ignored when `transport` is "sse". */
	inputRequiredIntervalMultiplier?: number;
	/** Stops polling without affecting the run itself. */
	signal?: AbortSignal;
	/** Consecutive poll failures tolerated before the subscription attempts one durable reconcile and stops. Defaults to 8. Ignored when `transport` is "sse" (an SSE transport failure falls back to polling instead; see `transport`). */
	maxConsecutiveFailures?: number;
	/**
	 * "poll" (default) drives a client-side poll loop against `pollAgentRun`,
	 * same as always. "sse" instead opens one push connection
	 * (`streamAgentRun`) and reconciles the exact same way on completion or
	 * pause; a transport-level SSE error (not a run error) closes the
	 * connection and falls back to the "poll" loop for the rest of this
	 * subscription's life, picking up from wherever the backend's drain
	 * buffer currently is -- no event is replayed twice, because the fallback
	 * only starts draining after the SSE connection has already closed.
	 */
	transport?: "poll" | "sse";
}

const TERMINAL_RUN_STATUSES: ReadonlySet<AgentRunStatusValue> = new Set([
	"COMPLETED",
	"FAILED",
	"CANCELLED",
]);

/**
 * @returns A fresh, empty items-state to seed a poll loop.
 *
 * Exported only for this file's own spec — not part of the public API
 * surface (not re-exported from the stores or package barrel).
 */
export const createAgentRunItemsState = (): AgentRunItemsState => ({
	itemsById: {},
	itemOrder: [],
});

/**
 * Apply one item event onto an items-state accumulator, returning a new
 * state. Pure and idempotent. Handles the two ways item text arrives:
 * incremental deltas, or all at once on item.started with no item.updated.
 *
 * Exported only for this file's own spec — not part of the public API
 * surface (not re-exported from the stores or package barrel).
 *
 * @param state - The accumulator to apply `event` onto.
 * @param event - The new event.
 * @returns The next items-state. Returns `state` unchanged if `event`
 * references an item not yet known (an out-of-order item.updated).
 */
export const applyAgentRunItemEvent = (
	state: AgentRunItemsState,
	event: AgentRunItemEvent,
): AgentRunItemsState => {
	if (event.type === "item.started") {
		const { item } = event;
		if (state.itemsById[item.id]) {
			return state;
		}
		return {
			itemsById: { ...state.itemsById, [item.id]: item },
			itemOrder: [...state.itemOrder, item.id],
		};
	}

	if (event.type === "item.updated") {
		const existing = state.itemsById[event.itemId];
		if (!existing) {
			return state;
		}
		let updated: AgentRunItem = existing;
		if (event.delta !== undefined) {
			if (existing.kind === "message") {
				updated = { ...existing, text: existing.text + event.delta };
			} else if (existing.kind === "reasoning") {
				updated = {
					...existing,
					summary: existing.summary + event.delta,
				};
			}
		} else if (event.patch) {
			updated = { ...existing, ...event.patch } as AgentRunItem;
		}
		return {
			...state,
			itemsById: { ...state.itemsById, [event.itemId]: updated },
		};
	}

	// item.completed
	const { item } = event;
	const alreadyKnown = Boolean(state.itemsById[item.id]);
	return {
		itemsById: { ...state.itemsById, [item.id]: item },
		itemOrder: alreadyKnown
			? state.itemOrder
			: [...state.itemOrder, item.id],
	};
};

/**
 * A single agent-harness run bound to a room, owning its own poll
 * subscription so callers never need a runId-keyed registry to poke it after
 * a tool decision — this instance IS that registry entry.
 *
 * Create a new run via {@link AgentStore.start}, or attach to one already in
 * progress (e.g. reconnecting after a page reload) via
 * `new AgentStore(roomId, insightId, runId)`.
 *
 * @see sdk-chat skill for the chat-vs-agent-harness guide.
 */
export class AgentStore {
	readonly roomId: string;
	readonly insightId: string;
	readonly runId: string;

	private _subscription: AgentRunSubscription | null = null;

	constructor(roomId: string, insightId: string, runId: string) {
		this.roomId = roomId;
		this.insightId = insightId;
		this.runId = runId;
	}

	/** True while this instance has a live poll subscription. */
	get isWatching(): boolean {
		return this._subscription !== null;
	}

	/**
	 * Settles when polling ends (terminal status, `stop()`, signal abort, or
	 * the consecutive-failure cap) with the last snapshot observed, or
	 * `null` if `watch()` was never called. Never rejects.
	 */
	get done(): Promise<AgentRunSnapshot | null> {
		return this._subscription?.done ?? Promise.resolve(null);
	}

	/**
	 * Start polling this run to completion, delivering item events and
	 * durable snapshots to `handlers` until a terminal status or `stop()`.
	 * Owns ordering, reconciliation timing, and retry/backoff — a transport
	 * failure never concludes the run failed.
	 *
	 * The underlying drain is destructive (two pollers would steal each
	 * other's events), so this is safe to call more than once on the SAME
	 * instance — later calls return the already-live subscription instead of
	 * starting a second poller — but never watch the same runId from two
	 * different `AgentStore` instances at once.
	 *
	 * @returns A handle to stop polling early, read the current items-state,
	 * force an immediate poll, or await the poll loop's end (`done`).
	 */
	watch(
		handlers: AgentWatchHandlers,
		options: AgentWatchOptions = {},
	): AgentRunSubscription {
		if (this._subscription) {
			return this._subscription;
		}

		const { runId } = this;
		const {
			pollIntervalMs = 500,
			inputRequiredIntervalMultiplier = 3,
			signal,
			maxConsecutiveFailures = 8,
			transport = "poll",
		} = options;
		const { onEvent, onSnapshot, onReconcile, onError } = handlers;

		let stopped = false;
		let lastSnapshot: AgentRunSnapshot | null = null;
		let reconciledStatus: AgentRunStatusValue | null = null;
		const seenEventIds = new Set<string>();
		let consecutiveFailures = 0;
		let itemsState = createAgentRunItemsState();
		// Set while the loop is between polls, so pokeNow can cut the current
		// wait short instead of leaving the caller stuck behind
		// INPUT_REQUIRED's slower interval for a change it already knows just
		// happened.
		let wake: (() => void) | null = null;
		// Lets stop() force-settle whichever SSE connection is currently open,
		// the same way wake lets it cut a poll-loop sleep short. Without this,
		// calling stop() while sseThenPollLoop is blocked on an open
		// connection (not sleeping between connections) would never resolve
		// `done` -- the EventSource stays open until the run itself finishes.
		let abortActiveConnection: (() => void) | null = null;

		const stop = () => {
			if (stopped) {
				return;
			}
			stopped = true;
			signal?.removeEventListener("abort", stop);
			wake?.();
			abortActiveConnection?.();
		};

		const pokeNow = () => wake?.();

		const sleep = (ms: number) =>
			new Promise<void>((resolve) => {
				const timer = setTimeout(() => {
					wake = null;
					resolve();
				}, ms);
				wake = () => {
					clearTimeout(timer);
					wake = null;
					resolve();
				};
			});

		signal?.addEventListener("abort", stop);

		const reconcile = async (status: AgentRunStatusValue) => {
			if (reconciledStatus === status) {
				return;
			}
			reconciledStatus = status;
			try {
				const full = await getAgentRun(runId, {
					includeMessages: true,
				});
				onReconcile(full);
			} catch (e) {
				onError?.(e as Error);
			}
		};

		const loop = async () => {
			while (!stopped) {
				let waitMs = pollIntervalMs;
				try {
					const { run, events, droppedEvents } =
						await pollAgentRun(runId);
					consecutiveFailures = 0;
					lastSnapshot = run;

					const sorted = [...events].sort(
						(a, b) => a.sequence - b.sequence,
					);
					let deliveredEvents = 0;
					for (const event of sorted) {
						if (seenEventIds.has(event.eventId)) {
							continue;
						}
						seenEventIds.add(event.eventId);
						itemsState = applyAgentRunItemEvent(itemsState, event);
						onEvent(event, itemsState);
						deliveredEvents++;
					}

					onSnapshot(run, { droppedEvents });

					if (run.status === "INPUT_REQUIRED") {
						await reconcile(run.status);
						waitMs =
							pollIntervalMs * inputRequiredIntervalMultiplier;
					} else if (TERMINAL_RUN_STATUSES.has(run.status)) {
						if (deliveredEvents > 0) {
							// The backend can still be flushing final item
							// events when the status first reads terminal —
							// keep draining on a short interval until a drain
							// comes back empty.
							waitMs = Math.min(pollIntervalMs, 100);
						} else {
							await reconcile(run.status);
							stop();
							break;
						}
					} else {
						// allow a later pause to reconcile again
						reconciledStatus = null;
					}
				} catch (e) {
					consecutiveFailures++;
					onError?.(e as Error);
					if (consecutiveFailures >= maxConsecutiveFailures) {
						// Transport is persistently failing — fall back to
						// one durable reconcile so the caller gets the
						// truth, then stop.
						try {
							const full = await getAgentRun(runId, {
								includeMessages: true,
							});
							lastSnapshot = full;
							reconciledStatus = full.status;
							onReconcile(full);
						} catch (reconcileError) {
							onError?.(reconcileError as Error);
						}
						stop();
						break;
					}
					waitMs = Math.min(
						pollIntervalMs * 2 ** Math.min(consecutiveFailures, 4),
						10_000,
					);
				}

				if (stopped) {
					break;
				}
				await sleep(waitMs);
			}
		};

		/**
		 * One SSE connection's whole life: replays from `afterSequence`,
		 * applies live events the same way `loop()` applies polled ones (same
		 * `seenEventIds`/`itemsState`, so switching transports mid-run never
		 * double-applies anything), and settles once the backend closes the
		 * stream (paused or terminal) or the transport itself errors.
		 *
		 * @returns "input_required" / "terminal" (the run told us, with
		 * `onReconcile` already fired for the final build before returning
		 * terminal), or "error" (the connection dropped unexpectedly — the
		 * caller falls back to `loop()`).
		 */
		const openSseConnection = (
			afterSequence: number,
		): Promise<{
			outcome: "input_required" | "terminal" | "error";
			lastEventSequence: number;
		}> =>
			new Promise((resolve) => {
				let settled = false;
				let lastEventSequence = afterSequence;
				const settle = (result: {
					outcome: "input_required" | "terminal" | "error";
					lastEventSequence: number;
				}) => {
					if (settled) {
						return;
					}
					settled = true;
					abortActiveConnection = null;
					resolve(result);
				};
				const connection = streamAgentRun(runId, afterSequence, {
					onRun: (run) => {
						lastSnapshot = run;
						onSnapshot(run, { droppedEvents: 0 });
						if (settled) {
							return;
						}
						if (run.status === "INPUT_REQUIRED") {
							connection.close();
							void reconcile(run.status).then(() =>
								settle({
									outcome: "input_required",
									lastEventSequence,
								}),
							);
						} else if (TERMINAL_RUN_STATUSES.has(run.status)) {
							connection.close();
							void reconcile(run.status).then(() =>
								settle({
									outcome: "terminal",
									lastEventSequence,
								}),
							);
						}
					},
					onEvent: (event) => {
						lastEventSequence = Math.max(
							lastEventSequence,
							event.sequence,
						);
						if (seenEventIds.has(event.eventId)) {
							return;
						}
						seenEventIds.add(event.eventId);
						itemsState = applyAgentRunItemEvent(itemsState, event);
						onEvent(event, itemsState);
					},
					onError: (error) => {
						if (settled) {
							return;
						}
						connection.close();
						onError?.(
							error instanceof ErrorEvent && error.error
								? (error.error as Error)
								: new Error("Agent run SSE transport error"),
						);
						settle({ outcome: "error", lastEventSequence });
					},
				});
				if (stopped) {
					connection.close();
					settle({ outcome: "terminal", lastEventSequence });
					return;
				}
				abortActiveConnection = () => {
					connection.close();
					settle({ outcome: "terminal", lastEventSequence });
				};
			});

		/**
		 * Drives SSE connections end to end: reopens on every INPUT_REQUIRED
		 * pause (the backend closes the stream rather than hold a connection
		 * open across a synchronous wait with nothing to push), stops on a
		 * true terminal status, and falls through to `loop()` — the ordinary
		 * poll loop, continuing from the same `lastEventSequence` the drain
		 * endpoint would otherwise have raced with — on the first transport
		 * error, for the rest of this subscription's life. SSE is never
		 * retried once it has errored once: a flaky connection that keeps
		 * reopening would thrash between push and poll instead of settling.
		 */
		const sseThenPollLoop = async () => {
			let afterSequence = 0;
			while (!stopped) {
				const { outcome, lastEventSequence } =
					await openSseConnection(afterSequence);
				afterSequence = lastEventSequence;
				if (stopped) {
					break;
				}
				if (outcome === "terminal") {
					stop();
					break;
				}
				if (outcome === "error") {
					break;
				}
				// input_required: allow a later pause to reconcile again once
				// the run resumes, then wait for pokeNow() (decide() calls it)
				// or the same slower retry interval the poll loop uses, and
				// reopen — the reopened connection's first "run" frame reports
				// whatever the current status actually is.
				reconciledStatus = null;
				await sleep(pollIntervalMs * inputRequiredIntervalMultiplier);
			}
			if (!stopped) {
				await loop();
			}
		};

		const done = (transport === "sse" ? sseThenPollLoop() : loop()).then(
			() => lastSnapshot,
			() => lastSnapshot,
		);

		this._subscription = {
			stop,
			getItems: () => itemsState,
			pokeNow,
			done,
		};
		return this._subscription;
	}

	/** Stop polling locally. Does not cancel the run itself. */
	stop(): void {
		this._subscription?.stop();
	}

	/** Poll immediately instead of waiting out the current interval. */
	pokeNow(): void {
		this._subscription?.pokeNow();
	}

	/** Fetch the durable snapshot directly (GetAgentRun), bypassing the poll loop. */
	async getSnapshot(
		options: { includeMessages?: boolean } = {},
	): Promise<AgentRunSnapshot> {
		return getAgentRun(this.runId, options, this.insightId);
	}

	/** Cancel the run on the backend (StopAgentRun). */
	async cancel(): Promise<AgentRunSnapshot> {
		return stopAgentRun(this.runId, this.insightId);
	}

	/**
	 * Decide a tool call paused on this run, resolving "submit" to "approve"
	 * (paramValues omitted or unchanged from pendingAction.toolArgs) or
	 * "edit" (paramValues differs) — the two decisions the backend treats
	 * identically except for which arguments the tool actually runs with.
	 * "respond" JSON-stringifies paramValues and sends it as mcpToolResult -
	 * the string a tool like RequestUserInput never actually executes to
	 * produce, so the answer stands in for it. Then wakes this instance's own
	 * poll loop immediately — no registry lookup needed, since this instance
	 * already owns the one subscription for its run.
	 *
	 * @param pendingAction - The paused call being decided.
	 * @param decision - "submit" auto-resolves to approve/edit as above; "reject"/"respond" pass through directly.
	 * @param paramValues - The (possibly edited) arguments for "submit", or the answer to encode for "respond". Ignored for "reject".
	 */
	async decide(
		pendingAction: PendingAgentAction,
		decision: "submit" | "reject" | "respond",
		paramValues?: Record<string, unknown>,
	): Promise<string> {
		// No paramValues means "run it as called" — approve, never a
		// paramValues-less edit (which the backend cannot execute).
		const resolvedDecision: AgentToolDecision =
			decision === "reject"
				? "reject"
				: decision === "respond"
					? "respond"
					: paramValues === undefined ||
							JSON.stringify(paramValues) ===
								JSON.stringify(pendingAction.toolArgs ?? {})
						? "approve"
						: "edit";

		const result = await decideAgentRunAction(
			{
				actionId: pendingAction.actionId,
				decision: resolvedDecision,
				paramValues:
					resolvedDecision === "edit" ? paramValues : undefined,
				mcpToolResult:
					resolvedDecision === "respond"
						? JSON.stringify(paramValues ?? {})
						: undefined,
			},
			this.insightId,
		);

		this.pokeNow();
		return result;
	}

	/**
	 * Submit a new agent-harness run and return an `AgentStore` bound to it,
	 * ready to {@link watch}.
	 *
	 * @param params - See {@link runAgent}.
	 * @param insightId - The active SEMOSS insight ID.
	 */
	static async start(
		params: Parameters<typeof runAgent>[0],
		insightId: string,
	): Promise<AgentStore> {
		const { runId, roomId } = await runAgent(params, insightId);
		return new AgentStore(roomId, insightId, runId);
	}
}
