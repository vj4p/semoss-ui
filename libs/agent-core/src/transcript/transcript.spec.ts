/**
 * The transcript projection, and its two renderings.
 *
 * Originally the Phase 0 spike: the throwaway that asked whether the agent event
 * model could drive a terminal UI at all. It answered yes, so the code it was
 * testing became `@semoss/agent-core` and the tests came with it. Three things
 * they hold down:
 *
 *  1. TYPES. The projection compiles against the real `AgentRunItem` union with
 *     a `never` exhaustiveness check, and the fixture compiles as a real
 *     `AgentRunItemEvent[]`. A fifth item kind added upstream breaks the build
 *     here rather than silently vanishing from the transcript.
 *  2. COMPOSITION. Folding is the SDK's, not ours. These drive the fixture
 *     through the very reducer `AgentStore.watch` uses internally, so any host
 *     inherits its ordering, dedup and delta handling rather than reimplementing
 *     them.
 *  3. ONE MODEL, TWO HOSTS. The same `Line[]` renders to plain text and to ANSI
 *     with no difference in content. That is the claim SEMOSS Code rests on: a
 *     CLI is a second renderer, not a second implementation.
 */

import { describe, expect, it } from "vitest";
import type { AgentRunItemsState } from "@semoss/sdk";
import {
	applyAgentRunItemEvent,
	createAgentRunItemsState,
} from "../../../sdk/src/stores/agent/agent.store";
import { formatTranscript, stripAnsi } from "../format/ansi";
import { toTranscript } from "./transcript";
import { FIXTURE, PROMPT } from "./transcript.fixture";

/**
 * Replay the fixture exactly as `AgentStore.watch` does: sort by `sequence`,
 * skip ids already seen, fold each event onto the accumulator.
 */
const foldFixture = (): AgentRunItemsState => {
	const seen = new Set<string>();
	let state = createAgentRunItemsState();
	for (const event of [...FIXTURE].sort((a, b) => a.sequence - b.sequence)) {
		if (seen.has(event.eventId)) {
			continue;
		}
		seen.add(event.eventId);
		state = applyAgentRunItemEvent(state, event);
	}
	return state;
};

describe("agent items -> terminal transcript", () => {
	it("folds every item kind the backend emits", () => {
		const state = foldFixture();
		const kinds = state.itemOrder.map((id) => state.itemsById[id]?.kind);
		// reasoning, 3 tools, 2 subagents, 1 message
		expect(new Set(kinds)).toEqual(
			new Set(["reasoning", "tool", "subagent", "message"]),
		);
		expect(state.itemOrder).toHaveLength(7);
	});

	it("accumulates streamed deltas into the reasoning summary", () => {
		const state = foldFixture();
		const reasoning = Object.values(state.itemsById).find(
			(i) => i.kind === "reasoning",
		);
		// Two deltas were emitted; the final item.completed carries the same
		// full text. Both paths must land on one identical summary.
		expect(reasoning).toMatchObject({
			summary:
				"The picker was hardcoded in two packages. Checking whether either copy survived the change.",
		});
	});

	it("projects one line per item, in start order, with the prompt first", () => {
		const lines = toTranscript(foldFixture(), { prompt: PROMPT });
		expect(lines[0]).toEqual({ kind: "prompt", text: PROMPT });
		expect(lines).toHaveLength(8); // prompt + 7 items
	});

	it("carries every status through to a distinct glyph", () => {
		const lines = toTranscript(foldFixture());
		const statuses = lines
			.filter((l) => l.kind === "tool" || l.kind === "subagent")
			.map((l) => (l as { status: string }).status);
		// REJECTED is tool-only; SUBMITTED reaches COMPLETED before we look.
		expect(statuses).toEqual([
			"COMPLETED",
			"REJECTED",
			"COMPLETED",
			"FAILED",
			"FAILED",
		]);
	});

	it("reduces a tool's output to a line count, never the payload", () => {
		const lines = toTranscript(foldFixture());
		const bash = lines.find((l) => l.kind === "tool" && l.label === "Bash");
		expect(bash).toMatchObject({ outputLines: 3, durationMs: 412 });
		// The transcript must not embed the output itself. Assert on a string
		// unique to the OUTPUT - not on the command, which the argument digest
		// is supposed to echo and which quotes the same symbol it searched for.
		expect(JSON.stringify(bash)).not.toContain("room-options-form");
	});

	it("detects the backend's 12,000-char truncation marker", () => {
		const lines = toTranscript(foldFixture());
		const pixel = lines.find(
			(l) => l.kind === "tool" && l.label === "semoss__RunPixel",
		);
		expect(pixel).toMatchObject({
			outputTruncated: true,
			status: "FAILED",
		});
	});

	it("names an anonymous subagent by run id, since alias is optional", () => {
		const lines = toTranscript(foldFixture());
		const labels = lines
			.filter((l) => l.kind === "subagent")
			.map((l) => (l as { label: string }).label);
		expect(labels).toEqual(["reviewer", "subagent run-cc09"]);
	});

	it("surfaces dropped events instead of rendering a silent gap", () => {
		// The backend caps a run's queue at MAX_EVENTS_PER_RUN = 2000 and evicts
		// the oldest. An unmarked hole reads as the agent having done nothing.
		const lines = toTranscript(foldFixture(), { droppedEvents: 37 });
		expect(lines.at(-1)).toMatchObject({
			kind: "divider",
			label: "37 earlier events dropped from the live feed",
		});
		expect(
			toTranscript(foldFixture(), { droppedEvents: 0 }).at(-1)?.kind,
		).not.toBe("divider");
	});

	it("renders the same transcript twice: plain text and ANSI", () => {
		const lines = toTranscript(foldFixture(), { prompt: PROMPT });
		const plain = formatTranscript(lines, { colour: false });
		const ansi = formatTranscript(lines, { colour: true });

		// One renderer, two presentations: identical row count, and the plain
		// form carries no escape codes at all.
		expect(ansi).toHaveLength(plain.length);
		expect(stripAnsi(plain.join("\n"))).toEqual(plain.join("\n"));
		expect(stripAnsi(ansi.join("\n"))).not.toEqual(ansi.join("\n"));

		// Stripping the codes from the ANSI form must return the plain form
		// exactly - proof that colour is presentation and carries no content.
		// This is the assertion that caught the alignment being padded against
		// raw string length, which silently shortened every coloured row.
		expect(ansi.map(stripAnsi)).toEqual(plain);

		// The judgement call: does it read like a terminal session?
		console.log(`\n${ansi.join("\n")}\n`);
	});

	it("is idempotent: re-rendering from scratch gives the same output", () => {
		// A terminal UI re-renders the whole viewport constantly. The projection
		// must be pure, or scrollback would drift from the live tail.
		const a = formatTranscript(toTranscript(foldFixture()), {
			colour: false,
		});
		const b = formatTranscript(toTranscript(foldFixture()), {
			colour: false,
		});
		expect(a).toEqual(b);
	});
});
