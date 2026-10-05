import { Env } from "../env";
import type {
	AgentRunItemEvent,
	AgentRunSnapshot,
	AgentRunStatusValue,
	AgentToolDecision,
	SubagentRunSummary,
} from "../types";
import { post } from "../utility";
import { runPixel } from "./base";

/**
 * Submit a durable agent run without waiting for it to finish (RunAgent with
 * wait=false). Poll progress with pollAgentRun(runId), or prefer
 * {@link AgentStore} (`stores/agent`) which owns the poll loop for you.
 *
 * @param params.roomId - Room the run's messages are written to.
 * @param params.command - The user's message text.
 * @param params.engine - Model engine id. Defaults to the room's configured model.
 * @param params.harnessType - Which agent harness runs the loop (e.g. "semoss").
 * @param params.agentId - The agent whose tools/config the run should use. Sent
 * to the backend as `workspaceId` -- a workspace IS the backend's agent record,
 * but "agent" is the term callers should use here.
 * @param params.maxTurns - Cap on model round-trips before the run stops itself.
 * @param params.maxReflections - Cap on self-reflection turns.
 * @param params.media - Media file locations to attach to the command. Any
 * file type the model accepts (image, pdf, document, spreadsheet, audio,
 * video), or base64 image/PDF data URIs.
 * @param params.urls - URLs to attach to the command.
 * @param params.paramValues - Extra run parameters forwarded to the harness.
 * The semoss harness honors `project` (project the run edits; also drives the
 * git-commit hook), `permissionMode` ("default" | "acceptEdits" | "plan" |
 * "bypassPermissions"), and strips its known keys before passing the rest
 * (e.g. `thinking`, `effort`) through to the model provider.
 * @param insightId - Insight to run the pixel against.
 * @returns The submitted run's id, room id, and initial status (always
 * "SUBMITTED") — not a full snapshot.
 */
/**
 * One agent harness this instance can run, as `GetAgentHarnesses` returns it.
 */
export interface AgentHarnessDescriptor {
	/** Registry key, and the value `RunAgent` expects as `harnessType`. */
	name: string;
	/** Human-readable label for pickers and status lines. */
	displayName: string;
	/** One sentence on what the harness is. May be empty. */
	description: string;
	/**
	 * Where the harness gets its tools. `PLATFORM` harnesses use the room's MCP
	 * toolboxes and capability packs; `HARNESS_NATIVE` ones bring their own, so
	 * switching changes which tools exist.
	 */
	toolSource: "PLATFORM" | "HARNESS_NATIVE" | "UNSPECIFIED";
	/** Whether the harness accepts current-turn media attachments. */
	supportsMediaInput: boolean;
	/**
	 * Whether a picker should offer it. Registered does not imply offered.
	 * Optional because a backend predating this field omits it; absent means
	 * "offer it".
	 */
	isSelectable?: boolean;
	/** True for the harness used when none is requested. */
	isDefault: boolean;
}

/**
 * The harnesses registered on this instance, default first.
 *
 * <p>Read from `AgentHarnessRegistry` rather than compiled in, because a
 * deployment can register its own harness at startup - any list baked into a
 * frontend is wrong the moment that happens, and it was previously duplicated
 * across packages that then drifted.
 *
 * Callers wanting a picker should filter on `isSelectable`.
 *
 * @param insightId - optional insight to run against
 * @return the registered harnesses; never rejects, see below
 */
export const getAgentHarnesses = async (
	insightId?: string,
): Promise<AgentHarnessDescriptor[]> => {
	const response = await runPixel<[AgentHarnessDescriptor[]]>(
		"GetAgentHarnesses();",
		insightId,
	);
	if (response.errors.length > 0) {
		throw new Error(response.errors.join(""));
	}
	return response.pixelReturn[0].output;
};

export const runAgent = async (
	params: {
		roomId: string;
		command: string;
		engine?: string;
		harnessType?: string;
		agentId?: string;
		maxTurns?: number;
		maxReflections?: number;
		media?: string[];
		urls?: string[];
		paramValues?: Record<string, unknown>;
	},
	insightId?: string,
): Promise<{ runId: string; roomId: string; status: AgentRunStatusValue }> => {
	const {
		roomId,
		command,
		engine,
		harnessType,
		agentId,
		maxTurns,
		maxReflections,
		media,
		urls,
		paramValues,
	} = params;

	const clauses = [
		`roomId=${JSON.stringify([roomId])}`,
		`command=${JSON.stringify([command])}`,
		engine ? `engine=${JSON.stringify([engine])}` : null,
		harnessType ? `harnessType=${JSON.stringify(harnessType)}` : null,
		// The backend's RunAgent pixel calls this workspaceId -- see the agentId
		// param doc above for why the public name here differs.
		agentId ? `workspaceId=${JSON.stringify([agentId])}` : null,
		maxTurns !== undefined ? `maxTurns=${JSON.stringify(maxTurns)}` : null,
		maxReflections !== undefined
			? `maxReflections=${JSON.stringify(maxReflections)}`
			: null,
		media && media.length > 0 ? `media=${JSON.stringify(media)}` : null,
		urls && urls.length > 0 ? `url=${JSON.stringify(urls)}` : null,
		paramValues && Object.keys(paramValues).length > 0
			? `paramValues=[${JSON.stringify(paramValues)}]`
			: null,
		"wait=false",
	].filter((clause): clause is string => clause !== null);

	const response = await runPixel<
		[{ runId: string; roomId: string; status: AgentRunStatusValue }]
	>(`RunAgent(${clauses.join(",\n")});`, insightId);

	if (response.errors.length > 0) {
		throw new Error(response.errors.join(""));
	}

	return response.pixelReturn[0].output;
};

/**
 * Drain buffered stream events for a run and get its current durable
 * snapshot in one call. Scoped to the run's owner by the backend. Each call
 * removes the drained events — there's no replay.
 *
 * @param runId - The run to poll.
 * @returns `run` — the current durable snapshot; `events` — new item events
 * since the last drain, unordered; `droppedEvents` — events evicted by the
 * backend's bounded buffer before this drain could collect them.
 */
export const pollAgentRun = async (
	runId: string,
): Promise<{
	run: AgentRunSnapshot;
	events: AgentRunItemEvent[];
	droppedEvents: number;
}> => {
	if (!runId) {
		throw new Error("Missing runId");
	}

	const response = await post<{
		run: AgentRunSnapshot;
		events: AgentRunItemEvent[];
		droppedEvents: number;
	}>(`${Env.MODULE}/api/engine/agentRunStreaming`, { runId });

	return response.data;
};

/**
 * Live counterpart to {@link pollAgentRun}: opens an SSE connection and
 * invokes `onEvent`/`onSnapshot` as the backend's push stream delivers them,
 * instead of a client-driven poll loop. Backed by `agentRunStreamingSse`.
 *
 * <p>Node affinity: the backend's event buffer is in-process, so this only
 * receives events when the connection lands on the node actually running
 * the run -- true today only when the deployment's load balancer honors
 * sticky sessions (the existing requirement for `pollAgentRun` too, which
 * reads the same in-process buffer). On a bare `fetch`-balanced deployment
 * without sticky sessions, prefer {@link AgentStore.watch}'s poll loop,
 * which this is not a replacement for — see its fallback behavior.
 *
 * @param runId - The run to stream.
 * @param afterSequence - Replay only events with `sequence > afterSequence`;
 * 0 replays everything the backend still has buffered for this run.
 * @param handlers.onRun - Fires with the run's current durable snapshot:
 * once immediately, and again whenever the run pauses for input or reaches
 * a terminal status (the same boundary {@link pollAgentRun}'s INPUT_REQUIRED
 * handling uses) — the connection closes right after that second call.
 * @param handlers.onEvent - Fires once per item event, already deduped and
 * ordered relative to events this same connection delivered — a caller that
 * reconnects with a new `afterSequence` is responsible for not double
 * applying events already applied from an earlier connection.
 * @param handlers.onError - Fires on a transport-level EventSource error
 * (not a `stream-error` payload, which is a request-validation failure the
 * backend reports deliberately — those are IllegalArgumentException-shaped
 * and non-retryable). The caller decides whether to reconnect or fall back
 * to polling.
 * @returns A `close()` to end the subscription. Does not cancel the run.
 */
export const streamAgentRun = (
	runId: string,
	afterSequence: number,
	handlers: {
		onRun: (run: AgentRunSnapshot) => void;
		onEvent: (event: AgentRunItemEvent) => void;
		onError?: (error: Event) => void;
	},
): { close: () => void } => {
	if (typeof EventSource === "undefined") {
		throw new Error("streamAgentRun requires a browser EventSource");
	}

	const url = new URL(
		`${Env.MODULE}/api/engine/agentRunStreamingSse`,
		typeof window !== "undefined" ? window.location.origin : undefined,
	);
	url.searchParams.set("runId", runId);
	url.searchParams.set("lastEventSequence", String(afterSequence));

	// Session-cookie auth, not a bearer token — EventSource can't carry a
	// custom Authorization header, so this only works for cookie-based
	// sessions (the same auth the poll endpoint's HttpSession check expects).
	const source = new EventSource(url.toString(), { withCredentials: true });

	source.addEventListener("run", (message) => {
		handlers.onRun(JSON.parse((message as MessageEvent).data));
	});
	source.addEventListener("event", (message) => {
		handlers.onEvent(JSON.parse((message as MessageEvent).data));
	});
	source.addEventListener("stream-error", (message) => {
		const payload = JSON.parse((message as MessageEvent).data) as {
			errorMessage?: string;
		};
		handlers.onError?.(
			new ErrorEvent("error", {
				error: new Error(
					payload.errorMessage || "Agent run stream error",
				),
			}),
		);
	});
	if (handlers.onError) {
		source.onerror = handlers.onError;
	}

	return { close: () => source.close() };
};

/**
 * Get the durable AgentRun snapshot directly (GetAgentRun), optionally with
 * this run's persisted room messages. For reconciliation, not live progress.
 *
 * @param runId - The run to fetch.
 * @param options.includeMessages - Also fetch this run's persisted room messages.
 * @param insightId - Insight to run the pixel against.
 * @returns The durable snapshot; `messages` is only populated when
 * `includeMessages` is true.
 */
export const getAgentRun = async <
	M extends Record<string, unknown> = Record<string, unknown>,
>(
	runId: string,
	options: { includeMessages?: boolean } = {},
	insightId?: string,
): Promise<AgentRunSnapshot & { messages?: M[] }> => {
	if (!runId) {
		throw new Error("Missing runId");
	}

	const clauses = [
		`runId=${JSON.stringify([runId])}`,
		options.includeMessages ? "includeMessages=true" : null,
	].filter((clause): clause is string => clause !== null);

	const response = await runPixel<[AgentRunSnapshot & { messages?: M[] }]>(
		`GetAgentRun(${clauses.join(",\n")});`,
		insightId,
	);

	if (response.errors.length > 0) {
		throw new Error(response.errors.join(""));
	}

	const output = response.pixelReturn[0].output;

	// The backend only sets pendingActions while INPUT_REQUIRED — normalize it
	// here so this always matches AgentRunSnapshot's contract for every caller.
	return { ...output, pendingActions: output.pendingActions ?? [] };
};

/**
 * Cancel a durable agent run (StopAgentRun). The backend interrupts the
 * harness, marks the run CANCELLED unless it already reached a terminal
 * status, and notifies its stream — a live subscription observes the
 * CANCELLED snapshot on its next poll (pokeNow() it for immediacy).
 *
 * @param runId - The run to cancel.
 * @param insightId - Insight to run the pixel against.
 * @returns The run's durable snapshot after the stop was applied.
 */
export const stopAgentRun = async (
	runId: string,
	insightId?: string,
): Promise<AgentRunSnapshot> => {
	if (!runId) {
		throw new Error("Missing runId");
	}

	const response = await runPixel<[AgentRunSnapshot]>(
		`StopAgentRun(runId=${JSON.stringify([runId])});`,
		insightId,
	);

	if (response.errors.length > 0) {
		throw new Error(response.errors.join(""));
	}

	const output = response.pixelReturn[0].output;

	// Same normalization as getAgentRun — the backend omits pendingActions
	// unless the run is INPUT_REQUIRED.
	return { ...output, pendingActions: output.pendingActions ?? [] };
};

/**
 * Decide a pending agent tool call (RunMCPTool's HITL path) — resumes the run
 * once every pending action in the batch has been decided. For the common
 * case of resolving approve vs. edit from submitted params automatically, use
 * {@link AgentStore.decide} instead.
 *
 * @param params.actionId - The PendingAgentAction.actionId being decided.
 * @param params.decision - "approve"/"edit" execute the tool; "reject"/"respond" don't.
 * @param params.paramValues - Required for "edit" (the tool's re-run arguments); ignored otherwise.
 * @param params.mcpToolResult - Required for "respond" (the string the tool "returned", e.g. JSON-stringified answers); ignored otherwise.
 * @param insightId - Insight to run the pixel against.
 * @returns The tool-result string the decision produced.
 */
export const decideAgentRunAction = async (
	params: {
		actionId: string;
		decision: AgentToolDecision;
		paramValues?: Record<string, unknown>;
		mcpToolResult?: string;
	},
	insightId?: string,
): Promise<string> => {
	const { actionId, decision, paramValues, mcpToolResult } = params;

	const clauses = [
		`actionId=${JSON.stringify([actionId])}`,
		`decision=${JSON.stringify([decision])}`,
		decision === "edit"
			? `paramValues=${JSON.stringify(paramValues ?? {})}`
			: null,
		decision === "respond"
			? `mcpToolResult=${JSON.stringify([mcpToolResult ?? ""])}`
			: null,
	].filter((clause): clause is string => clause !== null);

	const response = await runPixel<[string]>(
		`RunMCPTool(${clauses.join(",\n")});`,
		insightId,
	);

	if (response.errors.length > 0) {
		throw new Error(response.errors.join(""));
	}

	return response.pixelReturn[0].output;
};

/**
 * List every direct subagent run spawned by a parent run, newest first —
 * durable and DB-backed (GetSubagentRuns), unlike the ephemeral subagent item
 * events on the parent's own stream. Use to reconstruct subagent state after
 * a reload, where the stream has nothing left to replay.
 *
 * @param runId - The parent run whose direct subagent runs should be returned.
 * @param insightId - Insight to run the pixel against.
 * @returns Every direct child run, newest first.
 */
export const getSubagentRuns = async (
	runId: string,
	insightId?: string,
): Promise<SubagentRunSummary[]> => {
	if (!runId) {
		throw new Error("Missing runId");
	}

	const response = await runPixel<[SubagentRunSummary[]]>(
		`GetSubagentRuns(runId=${JSON.stringify([runId])});`,
		insightId,
	);

	if (response.errors.length > 0) {
		throw new Error(response.errors.join(""));
	}

	return response.pixelReturn[0].output;
};
