/**
 * `@semoss/agent-core` — the agent concern, with no host in it.
 *
 * Everything here runs unchanged in a browser, in Node, and in a test with no
 * DOM. That is the whole point: SEMOSS Code is a second HOST over this code, not
 * a second implementation of it, and the only thing that reliably keeps a shared
 * core shared is that it cannot reach for React, `window` or `console`.
 *
 * The compiler does not hold that line — the tsconfig has to include the `dom`
 * lib because `@semoss/sdk` is consumed at source. React is not a dependency, so
 * an import of it has nothing in the workspace to resolve to. `window` and
 * `document` fail at runtime, because the suite runs under vitest's `node`
 * environment. `console` exists everywhere, so that one is convention: nothing
 * here logs, and a failure a host must hear about goes to a reporter the host
 * passes in.
 *
 * MobX is deliberately not on that list. Plain `mobx` — never `mobx-react-lite`
 * — is how observable state here would reach both hosts, but nothing needs it
 * yet, so it is not a dependency either.
 *
 * What is NOT here is as deliberate as what is. `agent-harness.ts`'s run
 * orchestration, `tool.store.ts` and `room.store.ts` all read and mutate the
 * harness's MobX chat stores (`ResponseMessageStore`, `InputMessageStore`,
 * `ToolStore`, `RoomStore`) and its `@/types` message-part shapes. Moving them
 * would mean moving the chat model too, which is a rewrite wearing a
 * refactor's clothes. They stay in the harness until a second host actually
 * needs them, and then they get generalised deliberately.
 */

export * from "./format/ansi";
export * from "./format/cost";
export * from "./harness/harness-types";
export * from "./packs/capability-packs";
export * from "./packs/read-packs";
export * from "./run/run-registry";
export * from "./transcript/line";
export * from "./transcript/transcript";
