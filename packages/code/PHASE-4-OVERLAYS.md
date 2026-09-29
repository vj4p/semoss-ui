# Phase 4: Overlay Commands — Design

## Overview

Six full-screen overlay commands following the `less`/`fzf` idiom:
- Invoked by command (`:files`, `:diff`, `:runs`, `:packs`, `:cost`, `:inbox`)
- Full-screen z-index overlay with backdrop
- Dismissed with `q` key or Escape
- Keyboard-first navigation within each overlay

Plus status bar additions: cost, context %, branch (tied to `:cost` command).

## Architecture

### Overlay Infrastructure

**New directory**: `src/components/overlay/`

**Core pattern**:
```tsx
<OverlayContainer 
  open={showOverlay}
  onDismiss={() => setShowOverlay(false)}
  title="Files"
>
  {/* overlay-specific content */}
</OverlayContainer>
```

**OverlayContainer** (`overlay-container.tsx`):
- Full-screen fixed position, z-index above everything
- Backdrop (semi-transparent)
- Content area (white/dark bg, rounded corners, max-width)
- Header with title and close button
- Listens for `q` and Escape keys
- Focuses first interactive element on mount
- Traps focus within overlay
- Restores focus to prompt on dismiss

**Console integration** (`console.tsx`):
- New state: `activeOverlay: "files" | "diff" | ... | null`
- Conditionally renders overlay when `activeOverlay` is set
- Session command handlers call `setActiveOverlay("files")` etc.

### Commands

Register in `session-commands.ts`:

```ts
{
  name: "files",
  describe: "session.files" // "Browse files"
  run: (session, args) => {
    session.commands.showOverlay("files")
    return true
  }
}
```

Session gains:
- `showOverlay(name: string): void` method
- `SessionHost` interface adds `onShowOverlay?: (name: string) => void`
- Console implements the callback to set its `activeOverlay` state

## Implementation Plan

### 4a: Infrastructure + `:files`

1. **Overlay infrastructure**
   - `OverlayContainer` component
   - Console state + session callback wiring
   - Keyboard handling (q/Escape)

2. **`:files` command**
   - Simplified file browser (no create/delete, just browse + open)
   - Uses `@semoss/sdk` `getAssets()` API
   - Tree view with expand/collapse
   - Opens files in... where? (Decision: for now, just shows file content in the overlay, or copy path to clipboard)

### 4b: `:diff`, `:runs`, `:packs`

3. **`:diff` command**
   - Uses `@semoss/sdk` Git APIs or Bash git command
   - Shows current working directory changes
   - Syntax-highlighted diff viewer (Monaco in diff mode?)

4. **`:runs` command**
   - Shows run history for current room
   - List with timestamps, prompts, status
   - Select to view transcript
   - Uses `sessionState.entries` history

5. **`:packs` command**
   - Displays capability packs from agent-core's `readCapabilityPacks`
   - Grouped by category (Function, Storage, Vector, Model)
   - Shows tools available in each pack

### 4c: `:cost` + `:inbox`

6. **`:cost` command**
   - Displays cost/usage for current room
   - Breakdown by model, tokens, calls
   - Also adds to status bar: cost, ctx %, branch

7. **Status bar updates**
   - Add cost display (running total for room)
   - Add context % (tokens used / available)
   - Add git branch indicator
   - These appear right of the harness/model selects

8. **`:inbox` command**
   - Notifications/messages
   - Initially: just a placeholder
   - Future: system messages, collaboration notifications

## Open Questions

1. **File operations in `:files`**: Opens where? Copy path? Show content inline?
2. **`:diff` without Monaco**: Can we avoid Monaco for diffs? (Lighter weight)
3. **`:cost` data source**: Where does cost tracking live? Is it implemented yet?
4. **`:inbox` scope**: What actually goes here? Can defer to Phase 6?

## Testing Strategy

- Each overlay gets component tests (mount, dismiss with q, keyboard nav)
- Integration test: console can open each overlay via command
- Manual: actually use each one in the dev server

## Timeline Estimate

- **4a** (infra + :files): ~4-6 hours
- **4b** (:diff, :runs, :packs): ~6-8 hours
- **4c** (:cost + status bar, :inbox): ~4-6 hours

**Total**: ~14-20 hours of focused work, probably 3-4 commits.

## Next Steps

Start with 4a:
1. Build `OverlayContainer`
2. Wire session → console callback
3. Implement `:files` with simple file tree
4. Test + commit as "feat(code): add overlay infrastructure and :files command"
