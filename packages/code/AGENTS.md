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
| `components/console/` | The console: `console.tsx` stacks the transcript, the pending actions, the prompt and the status bar; `line-view.tsx` draws agent-core's lines; `argument-list.tsx` is a tool call's arguments, on its approval card and in its opened line; `pending-actions.tsx` shows what a run waits on; `announcer.tsx` is the screen-reader channel; `completion-menu.tsx` shows Tab completion suggestions. `prompt-input`, `pending-actions`, `status-bar`, `line-view` and `transcript` have component tests beside them |
| `components/overlay/` | Full-screen overlay views: `overlay-container.tsx` (base pattern), `help-overlay.tsx` (categorized help), `history-search-overlay.tsx` (Ctrl+R), `files-overlay.tsx`, `diff-overlay.tsx`, `runs-overlay.tsx`, `packs-overlay.tsx`, `cost-overlay.tsx`, `inbox-overlay.tsx`. All dismissed with `q` or Escape |
| `hooks/` | `use-console-session` (a session for the URL's room), `use-catalog`, `use-completions` (Tab completion provider), `use-session-state`, `use-line-labels` (the words the transcript adds to agent-core's lines), `use-elapsed-seconds` (a run's time, and a running tool call's), `use-ready-approval` (when the approval keys may act) |
| `pages/` | `router.tsx`, `initialized.layout.tsx`, `authenticated.layout.tsx`, `console.page.tsx`, `login.page.tsx`, `error.page.tsx` |
| `utility/` | `session-backend.ts` (agent-core's backend port, over the SDK), `translate.ts`, `announcements.ts`, `line-styles.ts`, `download.ts`, `keyboard.ts` (the platform, and the approval keys that the hints and buttons name) |
| `app.tsx`, `main.tsx`, `index.css` | App entry files |

## Key Dependencies

- `@semoss/agent-core` — the session, the transcript lines, the commands, the keymap, the
  completion system (`commands/completion.ts`), and the English of every message they produce
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
  waiting on the user (with how to answer it, in the words of the transcript's hint), the
  server not answering (once, not per retry), and how a run ended. It does not announce a
  run's start, its answer, the user's own input, or a reopened room's history.
- **Focus.** The prompt has focus from the start. Deciding a pending action sends focus back
  to the prompt *before* the decision goes out, because the button pressed is about to
  disappear.
- **Pending actions are `FieldSet` / `FieldLegend` groups**, so that a screen reader names
  the tool with its buttons. Not `role="group"`, which Biome's `useSemanticElements` rejects.
- **Approve what you read.** A waiting tool call's card lists every argument whole, in a
  `dl`, the telling one first, with bidi and zero-width characters shown as markers such as
  `⟨U+202E⟩` (agent-core's `describeArguments`), so that an argument cannot read in a
  different order from the one that runs. Each value is a `<pre dir="ltr">` that wraps, and
  the pending list scrolls past a third of the console. Edit puts an `:edit` line in the
  prompt, in place of anything typed there, and Always allow approves the call and every
  later call of its tool, for this session.
- **The approval keys.** From an empty prompt, A, D, E and Shift+A approve, deny, edit or
  always allow the first waiting call that is not a question. They act only once that call
  has been on screen for `APPROVAL_KEY_DELAY_MS` (`useReadyApproval`), so that a key already
  on its way when the card appears types instead, and the wait starts again whenever the call
  changes. A key decides the call only if the session still waits on it when the key is
  pressed. While the keys work, the placeholder names them and that call's buttons show them
  as `Kbd` caps, `aria-hidden` because the announcer's hint names them already. The
  transcript's hint names the keys whenever the console binds them.
- **What runs without asking stays in sight.** The status bar lists the always-allowed
  tools, a list named by its label, for as long as they are allowed. `:allowed` lists them
  too, and `:revoke` asks about one again.
- **A tool call opens.** A call with arguments or output to show is a `<details>` whose
  summary is its row, a tab stop with the focus outline. It opens on every argument, drawn by
  `ArgumentList` as on the approval card, and on the output, under labels that are muted `<p>`s
  rather than headings, so that the heading keys still step from one prompt to the next. The
  body is rendered while the call is closed, so that find-in-page can reach it. A failed
  call's error stays outside the disclosure, in sight, and a call with nothing more to show is
  a plain row. A line keeps its open state while its run goes on.
- **What opens is bounded.** A room's history keeps a call's output whole, so agent-core cuts
  it, and an error, at the live stream's 12,000 characters, ending in the backend's marker, so
  that one call cannot put megabytes on a line. The size and the truncated badge describe what
  the line holds. Invisible characters in both show as markers, as in arguments.
- **A running call counts its seconds**, from when the console first drew it running
  (agent-core's `runningSince`), so that the wait for an approval is not counted. The count
  is `aria-hidden`: the summary names the disclosure, whose name would otherwise change every
  second, and the status bar keeps the run's time.
- **Opening a call counts as reading it.** The transcript stays put once what opened runs
  past its end, rather than scroll it away on the next update, and follows the run again once
  the end is back in view. A `toggle` event does not bubble, so the transcript hears it in the
  capture phase.
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
- **A, D and E in a screen reader's browse mode** are its quick-navigation keys, so they reach
  the prompt only in focus mode, which a screen reader normally enters when the prompt has
  focus. `:approve`, `:deny`, `:edit` and `:always` do the same things.

### Right to left

- The Arabic `code.json` wraps every command token (`:help`, `:{{name}}`, `{{usage}}`) in
  U+2066 … U+2069 bidi isolates, so a right-to-left line does not show `:help` as `help:`.
  They are written as `\u2066` / `\u2069` escapes so a diff shows them. The parity test in
  `utility/translate.test.ts` fails if one is dropped.
- Room names are drawn in `<bdi>`. Segments that are file paths or key chords stay left to
  right (`isLeftToRight` in `line-styles.ts`).
- Argument values and a call's output are left to right, as code is, in `<pre dir="ltr">`
  blocks that are `w-fit max-w-full`: as wide as their text and no wider than the line, so
  that in a right-to-left console each sits under its label rather than across the page from
  it. The summary is `w-fit` too, so that its focus outline, and the area a click toggles, end
  where the row does.
- **Not fixed yet:** a tool's or a subagent's error, and a subagent's result preview, are
  `dir="auto"` blocks, so English text in them sits at the far left of a right-to-left
  console, away from its row.

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
| `Kbd`'s own `bg-muted` and `text-muted-foreground`, in a button | the 4.35:1 pair above, and a grey cap on the primary button | the button's colour: `bg-transparent text-current border-current/30` |

- **The `Toaster` is mounted for shared components only.** The console reports in its
  transcript. `AgentUserInputCard` says which question is unanswered in a toast, and
  `LoginForm` confirms an OAuth sign-in in one.
- **The prompt is a command line, not a form,** so the react-hook-form + zod rule does not
  apply to it. There is nothing to validate before it is sent, and the answer arrives in the
  transcript, not beside it. The status bar's harness and model selects apply as they change.
- **A tool call's chevron ends its row**, so that the status glyphs stay in one column. It is
  a glyph, `▸` mirrored right to left and `▾` once open, not a Lucide icon: this package does
  not depend on `lucide-react`, and adding it would change `pnpm-lock.yaml`. The summary hides
  the browser's own triangle with `list-none` and, for WebKit, the
  `[&::-webkit-details-marker]:hidden` variant.

## Tooling Notes

- **Tests are `*.test.ts`**, like the other apps, or `*.test.tsx` for a component. Agent-core's
  are `*.spec.ts`. A component test renders against a fake session, an object that
  `satisfies Partial<Session>`, with the real English strings from
  `new I18nBuilder(codeResources, { lockToEnglish: true })` and no provider. Fake timers work
  under the `vmForks` pool. `line-view` and `transcript` draw a `Transcript` of lines made by
  hand instead, and `transcript` gives the log the heights that jsdom does not lay out.
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

## Commands and Overlays

The console offers built-in commands (`:help`, `:harness`, `:model`, etc.) and full-screen overlay views for information browsing. All commands are discoverable via `:help`.

### Overlay Commands

Six overlay commands provide full-screen information views, following a consistent pattern:
- Dismissed with `q` key or Escape
- Full-screen with backdrop (OverlayContainer pattern from Phase 4)
- Keyboard-first navigation within each overlay

| Command | Description | Status |
|---------|-------------|--------|
| `:files` | Browse files in workspace | Placeholder (hardcoded tree) |
| `:diff` | Git diff viewer | Functional (parses `git diff HEAD`) |
| `:runs` | Run history browser | Functional (from session entries) |
| `:packs` | Capability packs display | Functional (calls `readCapabilityPacks`) |
| `:cost` | Cost/usage breakdown | Placeholder (structure defined) |
| `:inbox` | Notifications/messages | Placeholder (roadmap shown) |

**Implementation notes:**
- `DiffOverlay`: Runs `git diff HEAD` via `runPixel`, parses output, syntax-highlights additions/deletions
- `RunsOverlay`: Extracts from `session.getState().entries` (RunEntry and InputEntry types)
- `PacksOverlay`: Calls `readCapabilityPacks` from agent-core, displays tool counts and engine requirements
- `CostOverlay` and `InboxOverlay`: Placeholder components with "implementation pending" notes
- All overlays are wired through `onShowOverlay` callback from session commands to console state

### Ergonomics Features (Phase 6)

Three keyboard-first ergonomics features enhance the terminal experience:

#### Ctrl+R History Search (Phase 6a)

- **Trigger**: `Ctrl+R` (Windows/Linux) or `Cmd+R` (Mac)
- **What it does**: Opens full-screen fuzzy search through command and prompt history
- **Features**:
  - Live filtering as you type (substring match, case-insensitive)
  - Keyboard navigation (↑↓ arrows, Enter to select, Escape to dismiss)
  - Highlights matching text (yellow background)
  - Type badges show "cmd" or "prompt" for each item
  - Auto-submits selected command/prompt
- **Source**: Extracts from `session.getState().entries` (RunEntry.prompt, InputEntry.text)
- **Component**: `HistorySearchOverlay`

#### Tab Completion (Phase 6b)

- **Trigger**: `Tab` key when text exists in prompt
- **What it does**: Context-aware completion for commands and arguments
- **Completes**:
  - Command names after `:` (all registered commands)
  - Harness names after `:harness ` (from catalog.harnesses)
  - Model names/IDs after `:model ` (from catalog.models)
  - Tool names after `:revoke ` (from alwaysAllowed list)
- **Navigation**:
  - Tab/Shift+Tab: Navigate through completions
  - Arrow keys: Navigate when menu is open
  - Enter or Tab at end: Select completion
  - Escape: Dismiss menu
- **Implementation**:
  - Completion logic in `libs/agent-core/src/commands/completion.ts`
  - `useCompletions` hook provides session-aware completions
  - `CompletionMenu` component shows popup below input
  - `parseCommandContext` analyzes cursor position for context
- **Non-modal**: Tab still works for focus navigation when no text or no matches

#### Improved :help Overlay (Phase 6c)

- **Trigger**: `:help` command
- **What it does**: Shows categorized command and keyboard shortcut reference
- **Features**:
  - Search/filter functionality (searches commands, shortcuts, categories)
  - Categorized commands:
    - Control: stop, approve, deny, edit, always
    - Navigation: clear
    - Information: help, files, diff, runs, packs, cost, inbox
    - Session: harness, model, new, allowed, revoke, export
  - Keyboard shortcuts section with platform-aware formatting (Mac symbols ⌃⌥⇧ vs Ctrl+Alt+Shift+)
  - Tips section (e.g., "Type :: to send a prompt starting with :")
- **Component**: `HelpOverlay`
- **Backwards compatible**: Falls back to transcript output if overlay not available

### Control Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `:stop` | - | Stop the running agent |
| `:approve` | `:allow` | Allow the waiting tool call |
| `:deny` | `:reject` | Reject the waiting tool call |
| `:edit <json…>` | - | Change the waiting call's arguments, then approve it |
| `:always` | - | Approve the waiting call, and stop asking about its tool |

### Session Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `:harness [name…]` | - | Show harnesses, or switch to one |
| `:model [name…]` | - | Show models, or switch to one |
| `:new` | - | Start a new room |
| `:clear` | - | Clear the screen (keeps history) |
| `:allowed` | - | List tools that run without asking |
| `:revoke [tool…]` | - | Ask about a tool again, or all when none named |
| `:export` | - | Save the last run's raw events as JSON |

All commands have i18n support across 7 languages (ar, en, es, fr, hi, ja, nl).

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
