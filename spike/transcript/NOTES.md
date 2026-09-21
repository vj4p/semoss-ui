# Phase 0 spike — findings

Throwaway code, durable findings. This directory is deliberately **outside** the
pnpm workspace globs (`packages/*`, `libs/*`), so nothing here is built,
published, or reachable from `packages/harness`. Ground rule 1 holds by
construction rather than by care.

## Verdict

**The event model supports a terminal UI.** Every one of the four item kinds
projects onto a single transcript line, the projection is pure and idempotent,
and the same `Line[]` renders to both plain text and ANSI with no content
difference. Phase 1 can proceed.

## How to run it

```bash
cd semoss-ui
libs/sdk/node_modules/.bin/vitest run spike/transcript/spike.spec.ts --root . \
  --disable-console-intercept          # prints the rendered transcript
(cd spike/transcript && ../../node_modules/.bin/tsc -p tsconfig.json)
node_modules/.bin/biome check spike/
```

Three gates, all green: 10/10 tests, `tsc` clean, Biome clean.

The typecheck is the load-bearing one, and it was verified to actually bite — a
fifth `AgentRunItem` variant temporarily added to `libs/sdk/src/types.ts`
produced `TS2322: Type '{...}' is not assignable to type 'never'` at the
exhaustiveness check, and was reverted byte-exact. A green typecheck that cannot
fail would prove nothing.

## Where the design sketch was wrong

The plan's `Line` model was written from memory of the SDK. Five corrections,
all now in `line.ts`:

| Sketch said | Reality |
|---|---|
| `{ kind: "prompt"; role: "user" }` derived from the stream | `AgentRunItem` of kind `message` is typed **`role: "assistant"` only**. The user's own prompt is never an item — the host must inject it, or read `inputMessageId` off the durable snapshot. |
| `{ kind: "subagent"; depth: number }` | There is **no depth**. A subagent item carries `childRunId`/`roomId`/`alias` and nothing positional. Every subagent in one run's stream is a direct child; real nesting means recursively watching each `childRunId`, and whoever does that owns the indent. |
| One status enum, 7 glyphs | **Two different enums.** Tools use `AgentStreamItems.TOOL_*` (has `QUEUED`, `REJECTED`); subagents use `AgentRunStatus` (has `SUBMITTED`, never `REJECTED`). The union is **8** values, and a glyph map missing one renders blank. |
| `reasoning.text` | The field is **`summary`**. |
| `{ kind: "tool"; ... }` with no error | A failed **subagent** carries `error` too. Omitting it rendered a failed subagent as a bare `✘` with no reason — caught by reading the output, not by a test. |

## What the emitter actually guarantees

Read line by line from `AgentStreamItems` and `AgentRunStreamService`, not
assumed from the TS types, which are looser than the producer:

- **`patch` only ever carries `status`.** Verified at all three publish sites:
  `HarnessToolExecutor` (→`RUNNING`), `SemossAgentHarness.publishAskToolsInputRequired`
  (→`INPUT_REQUIRED`), `AgentRunExecutor.publishSubagentPatch` (subagent status).
  The type says `Record<string, unknown>`; in practice it is `{status}`.
- **`output` / `error` / `durationMs` arrive only on `item.completed`.**
  `AgentStreamItems.toolItem` does not build them; `publishToolItemTerminal`
  attaches them immediately before publishing. So a running tool can never show
  a partial result, and the transcript must not reserve space for one.
- **Text arrives two ways and both must work**: `started` + deltas +
  `completed`, or `started` + `completed` back to back carrying the full text
  (`completeActiveMessage` when no streaming message was active). The SDK
  reducer already handles both; the fixture exercises both.
- **Item ids are structured**: `runId + ":model:" + ordinal + ":message"`.
  Ordinal ordering is free if ever needed.

## Two findings that change the plan

### 1. Dropped events are a correctness requirement, not polish

`AgentRunStreamService.MAX_EVENTS_PER_RUN = 2000`, and once full it **evicts the
oldest event** and increments `droppedEvents`. A long run therefore has real
holes in its live feed, and the SDK already surfaces the count via
`onSnapshot(snapshot, { droppedEvents })`.

An unmarked hole reads as *the agent did nothing*, which is the worst possible
failure for a transcript. `toTranscript` takes `droppedEvents` and emits a
divider. The durable snapshot is the only way to recover the lost content.

The plan did not mention this at all.

### 2. Tool-output paging is weaker than it looked

Capability 2 (`GetAgentToolOutput`) was justified by "a tool returning megabytes
makes every poll heavy". It cannot: `HarnessToolExecutor.MAX_LIVE_TOOL_RESULT_CHARS
= 12_000` already truncates every tool result before it reaches the stream,
appending the literal marker `... [truncated for live stream]`. Subagent previews
are capped at 2,000.

So the payload is bounded server-side and the reactor buys only the ability to
read *past* the cap. Worth keeping as "if measured", but the poll-weight argument
should be struck — and the console should instead **show that truncation
happened**, which is now `outputTruncated` on the tool line.

## Two findings that shrink Phase 1

### The projection is a projection, not a second reducer

The plan said `AgentRunItemEvent -> Line[]`, which would have meant
re-implementing event folding. `applyAgentRunItemEvent` already does it — pure,
idempotent, tested, and correct about deltas. So the composition is:

```
events --(SDK fold)--> AgentRunItemsState --(ours)--> Line[]
```

and `transcript.ts` is ~60 lines of pure presentation with no state of its own.
`libs/agent-core/transcript` is much smaller than budgeted.

### No new SDK export is needed

`applyAgentRunItemEvent` is deliberately not in the barrel ("not part of the
public API surface"). That looked like a Phase 1 blocker, but it is not:
`AgentStore.watch`'s `onEvent(event, items)` already delivers the accumulated
state, and `subscription.getItems()` returns it on demand. The console's real
composition needs nothing private:

```ts
store.watch({
  onEvent:    (_e, items) => render(toTranscript(items, { prompt })),
  onSnapshot: (_s, { droppedEvents }) => setDropped(droppedEvents),
  ...
});
```

The spike imports the private reducer only to replay a fixture offline.

## The bug worth remembering

`statusColumn` padded against `String.length` on a string that already contained
SGR codes, so every coloured row came out shorter than its plain equivalent by
exactly as much colour as it carried — the status column wandered. My own comment
said "escape codes must not count toward width" directly above the line that
counted them.

The `expect(ansi.map(stripAnsi)).toEqual(plain)` assertion caught it. **Any
terminal renderer needs that assertion**; width-vs-escape-codes is the defining
bug of the genre, and a screenshot would never have shown it.

## Not verified here

The fixture is **emitter-derived, not captured from a live run** — written
against the producer so it covers every shape including `REJECTED`,
`INPUT_REQUIRED`, anonymous subagents and truncation, which any single real run
would miss, and annotated `AgentRunItemEvent[]` so the compiler enforces
legality.

What that does not prove is that a live backend populates these fields the way
the code reads. Capturing one real run against `localhost:9090` needs an
authenticated session, which was out of reach here. Worth doing at Phase 2, when
there is a UI to drive it from — but it would validate, not redirect: the shapes
come from the producer itself.
