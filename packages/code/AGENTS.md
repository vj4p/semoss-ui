# AGENTS.md - @semoss/code

This document provides context for AI coding assistants working with SEMOSS Code, the
terminal-style agent console.

> **Inherits from:** [../../AGENTS.md](../../AGENTS.md) for code style, file-naming, package
> structure, commit messages, Biome config, and Node/pnpm requirements.

## Overview

`@semoss/code` is a **private**, standalone application: a keyboard-first console for running
agents in a room, with no chat mode. It offers the harnesses `GetAgentHarnesses` reports as
selectable and names none itself: today that is `semoss` and `claude_code`, because
`github_copilot_py` is registered with `isSelectable()` false. It will be served from
`/packages/code/dist/`.

It is built **alongside** `@semoss/harness`, not on top of it. Nothing here imports from the
harness, and nothing here may need a change there: the harness stays what production serves
until the console replaces it.

The console is a thin React host over `@semoss/agent-core`. The agent-core session owns the
room, the runs, the commands, the keymap and the input history, and hands the console plain
data to draw: `SessionEntry` values made of `Line`s. Agent-core has no React and no DOM, so
that a CLI host can drive the same session later.

## Build System

- **Bundler**: Vite 8
- **State**: none of its own. The session is a plain store (`getState` / `subscribe`) that
  `useSessionState` reads with `useSyncExternalStore`. There is no MobX here.
- **Routing**: `react-router` 8, hash router
- **Styling**: Tailwind CSS v4, through `@semoss/ui/globals.css`

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the dev server on port 5180 (`DEV_SERVER_PORTS.code`) |
| `pnpm build` | Production build |
| `pnpm build:dev` | Development build |
| `pnpm type-check` | `tsc --noEmit` type check |
| `pnpm test` | Run tests (`vitest run --passWithNoTests`) |

From the repo root, `pnpm dev:code` starts it with its workspace dependencies.

The dev server proxies `MODULE` (`/Monolith`) to `ENDPOINT` (`http://localhost:9090`), both from
the committed `.env`. To sign in to a local Monolith with an access key, put `ACCESS_KEY` and
`SECRET_KEY` in `.env.local`, which is gitignored. A production build never reads them.

### Path Alias

- `@/` → `./src/`

## Structure

An application, so it uses the `src/` layout from the root AGENTS.md including `pages/`:

| Folder / file | Purpose |
|---------------|---------|
| `api/` | Pixel calls by domain: `rooms.ts` (open, create, read and write a room's options), `engines.ts` (the models, the user's default) |
| `components/console/` | The console: `console.tsx` stacks the transcript, the pending actions, the prompt and the status bar; `line-view.tsx` draws agent-core's lines; `announcer.tsx` is the screen-reader channel |
| `hooks/` | `use-console-session` (a session for the URL's room), `use-catalog`, `use-session-state`, `use-line-labels`, `use-elapsed-seconds` |
| `pages/` | `router.tsx`, `initialized.layout.tsx`, `authenticated.layout.tsx`, `console.page.tsx`, `login.page.tsx`, `error.page.tsx` |
| `utility/` | `session-backend.ts` (agent-core's backend port, over the SDK), `translate.ts`, `announcements.ts`, `line-styles.ts`, `download.ts` |
| `app.tsx`, `main.tsx`, `index.css` | App entry files |

## Key Dependencies

- `@semoss/agent-core` — the session, the transcript lines, the commands, the keymap, and
  the English of every message they produce
- `@semoss/sdk/react` — the only SDK entry imported here (for example `runPixel`, `Env`,
  `InsightProvider` and the agent-run types)
- `@semoss/ui/next` — every component, including `AgentUserInputCard` for a run's questions
- `@semoss/shared` — `LoginForm` and `useAgentHarnesses`
- `@semoss/i18n` — `codeResources`: the core namespaces plus one `code` namespace

## The session

- **One session per room, keyed on the URL.** `useConsoleSession` creates it for the room
  in `/room/:roomId`, or for a new room at `/`. The `Console` is keyed on the session's
  `generation`, so a new session never inherits the old one's focus, scroll or input.
- **The URL follows the session.** A room created by the first prompt *replaces* `/` with
  `/room/:roomId`. `:new` *pushes* `/`, so the back button returns to the room. Any other URL
  change, from the address bar or the back button, disposes the session and opens the room
  the URL names. A run still going at that point is not re-attached: reopening the room shows
  its saved history.
- **What a session starts with, it keeps.** The catalog, the default model and the translate
  function are read through a ref when the session is created. Recreating the session when
  they change identity would clear the transcript and stop following a run. The translate
  function reads the current language on every call, so a language switch still applies.
- **Every pixel runs in the room's insight**: the one it was opened in, or the one it was
  created in (`utility/session-backend.ts`).
- **Room options are shared with other UIs.** The console writes only `harnessType` and
  `modelId`, keeps every other key (`withRoomSettings`), and drops the MCP entries the backend
  only reports (`fromRoom`, `fromWorkspace`). It refuses options that are not a JSON map,
  rather than overwrite them on the next save.

## Accessibility

These were decided in Phase 2 of the plan rather than retrofitted:

- **One `main`, with a visually hidden `h1`.** The login page has no heading of its own:
  `LoginForm` renders the page's.
- **The transcript is `role="log"` with `aria-live="off"`.** A streaming run would read out
  every line. It has `tabIndex={0}`, so that keyboard users can scroll it.
- **The `Announcer` is the console's only live region** (polite, additions only). The page's
  others are the `Toaster`'s and, while something loads, the spinner's `role="status"`.
  `announcementsFor` decides what it says: the console's notices, a tool call or question
  waiting on the user (with how to answer it), the server not answering (once, not per
  retry), and how a run ended. It does not announce a run's start, its answer, the user's own
  input, or a reopened room's history.
- **Focus.** The prompt has focus from the start. Deciding a pending action sends focus back
  to the prompt *before* the decision goes out, because the button pressed is about to
  disappear.
- **Pending actions are `FieldSet` / `FieldLegend` groups**, so that a screen reader names
  the tool with its buttons. Not `role="group"`, which Biome's `useSemanticElements` rejects.
- **Status is never colour alone.** A glyph's shape carries it and a visually hidden word
  names it.
- **Keys are data.** They come from agent-core's `DEFAULT_KEYMAP`, and `:help` lists the same
  data. Tab and Shift+Tab are deliberately unbound, so the prompt is no keyboard trap (WCAG
  2.1.2). Ctrl+H is unused because it is delete-backward in any macOS text field; Alt+H cycles
  the harness instead.
- **Ctrl+C** interrupts a run only when the prompt has no selection. With no run it clears a
  non-empty line. With a selection nothing is bound, so the browser copies. Escape interrupts
  a run whether or not text is selected.

**Known keyboard risks, not yet checked with real browsers or screen readers:**

- **Escape under NVDA.** In focus mode NVDA may take Escape to return to browse mode, so it
  never reaches the prompt. Ctrl+C and `:stop` do the same thing.
- **Alt+H in Firefox** on Windows and Linux opens the Help menu. The prompt calls
  `preventDefault`, but nobody has checked whether that stops the menu. `:harness` does the
  same thing.
- **Ctrl+L on Windows and Linux** is the browser's address-bar shortcut, which the prompt
  takes over while it has focus. Alt+D and F6 still reach the address bar.

### Right to left

- The Arabic `code.json` wraps every command token (`:help`, `:{{name}}`, `{{usage}}`) in
  U+2066 … U+2069 bidi isolates, so a right-to-left line does not show `:help` as `help:`.
  They are written as `\u2066` / `\u2069` escapes so a diff shows them. The parity test in
  `utility/translate.test.ts` fails if one is dropped.
- Room names are drawn in `<bdi>`. Segments that are file paths or key chords stay left to
  right (`isLeftToRight` in `line-styles.ts`).

### 200% zoom

- The app wrapper is `h-svh overflow-hidden`. The console page's `main` scrolls only as a
  last resort, when zoom leaves too little height for its regions.
- The transcript keeps `min-h-24`. The pending list is `max-h-1/3 shrink-0`: it is a scroll
  container, so without `shrink-0` flex would squeeze it to nothing before `main` overflowed.
- The centred pages (login, error) use `items-center-safe justify-center-safe` with
  `overflow-y-auto`, so that zoom cannot push the top of their content out of reach.

## Design-System Notes

Follow the root [Design System & Styling](../../AGENTS.md#design-system--styling) rules and
[DESIGN.md](../../DESIGN.md). **`pnpm lint:design` does not exist in this repo**, although
both documents name it, so the design audit is done by hand against DESIGN.md.

Contrast decisions, measured against the tokens:

| Instead of | Because | Used |
|---|---|---|
| `ring` for the focus outline | 2.52:1 on the light theme's background | `outline-foreground` |
| `AlertDescription` | its `destructive/90` is 4.35:1 on the light theme's card | a plain block in the alert's own colour |
| `text-muted-foreground` on `bg-muted` | 4.35:1 on the light theme | not paired |
| `text-warning` for a waiting glyph | 2.15:1 on the light theme | the foreground colour there |
| `primary` for accented text | 4.3:1 on the dark theme's background | the foreground colour |

- **The `Toaster` is mounted for shared components only.** The console reports in its
  transcript. `AgentUserInputCard` says which question is unanswered in a toast, and
  `LoginForm` confirms an OAuth sign-in in one.
- **The prompt is a command line, not a form,** so the react-hook-form + zod rule does not
  apply to it. There is nothing to validate before it is sent, and the answer arrives in the
  transcript, not beside it. The status bar's harness and model selects apply as they change.

## Tooling Notes

- **Tests are `*.test.ts`**, like the other apps. Agent-core's are `*.spec.ts`.
- **`tsc` reports 14 errors, all in `libs/shared` source**: `audit-log-filter.tsx` (10),
  `audit-logs-detail-drawer.tsx` (2), `mcp-utils.ts` (1) and `notebook-sortable-cell.tsx`
  (1). They show up because this package is `strict` and shared is consumed as source. None
  are in this package, so any error here is new.
- **Monaco.** The `@semoss/shared` barrel re-exports `FileEditor`, so `vite.config.ts`
  aliases `monaco-editor` to its API-only entry, as client, harness, playground and terminal
  do. The build still emits the ~3 MB editor chunk, but nothing preloads it: only Monaco's
  own language chunks import it, and the console renders no editor.
- **Biome's class sorter does not know Tailwind 4.1's `*-safe` alignment utilities** and
  moves them to the front. It is cosmetic; leave it.
- **Three Biome suppressions**, each with its reason: `noNoninteractiveTabindex` on the
  transcript, and `noArrayIndexKey` twice in `line-view.tsx`, whose lines and segments have
  no id.
- **`index.html` ships the `semoss-env` tag** and the no-cache metas. The comment there says
  why a plain rebuild must not lose them.

## Agent Guardrails

### Be Cautious With

- **What belongs in agent-core.** Anything a CLI host would also need goes there: a command,
  a key, a message, how a run's items become lines. Its English lives in
  `libs/agent-core/src/i18n/messages.ts`, and its translations under `code:core.*` in all
  seven languages. The parity test checks every language's keys, placeholders, commands and
  plural forms.
- **`@semoss/harness`.** Do not import from it, and do not change it for this package's sake.
- **`api/rooms.ts`.** It writes room options that other UIs read.
- **`utility/session-backend.ts`.** Every pixel the session runs goes through it.
- **`vite.config.ts`** and **`index.html`.** Dev server, build, and the deployed shell.

### When Making Changes

```bash
pnpm --filter @semoss/code test
pnpm --filter @semoss/code type-check     # expect the 14 libs/shared errors, no others
pnpm --filter @semoss/code build
pnpm check
```

After a change to agent-core, also run its suite and the harness's, which consumes it:

```bash
pnpm --filter @semoss/agent-core test
pnpm --filter @semoss/harness test
```
