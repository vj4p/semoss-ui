# Terminal UI Development Status

This document tracks the implementation status of the SEMOSS Code terminal UI.

## Completed Phases

### Phase 3: Subagent Tree ✅
**Shipped:** 2026-09-27

- Subagent visualization in transcript
- Tool call details with arguments/output disclosure
- Running indicators and elapsed time
- Agent run item event handling

**Commits:**
- `00825b62b` - Phase 3c complete
- Earlier 3a, 3b commits

---

### Phase 4: Overlay Commands ✅
**Shipped:** 2026-09-28 to 2026-09-29

Six full-screen overlay commands with consistent UX pattern.

#### Phase 4a: Infrastructure + :files
**Shipped:** `6cde515`

- `OverlayContainer` component (full-screen, q/Esc to dismiss)
- Session plumbing (`onShowOverlay` callback)
- `:files` command (placeholder with hardcoded tree)

#### Phase 4b: :diff, :runs, :packs
**Shipped:** `c2c816d`

- `:diff` — Git diff viewer with syntax highlighting
- `:runs` — Run history browser (extracts from session entries)
- `:packs` — Capability packs display (calls `readCapabilityPacks`)

#### Phase 4c: :cost, :inbox, Status Bar
**Shipped:** `69c12c5`

- `:cost` — Cost/usage breakdown overlay (placeholder structure)
- `:inbox` — Notifications overlay (placeholder with roadmap)
- Status bar placeholders (cost $0.00, context 0%, branch ⎇—)

**Status:**
- All 6 overlay commands shipped
- Consistent pattern established
- 3 functional, 3 placeholders awaiting real implementations

---

### Phase 6: Ergonomics ✅
**Shipped:** 2026-09-29

Terminal usability features for professional workflow.

#### Phase 6a: Ctrl+R History Search
**Shipped:** `edea45c`

- Full-screen fuzzy search through command/prompt history
- Keyboard navigation (↑↓, Enter, Esc)
- Highlight matching text
- Type badges (cmd/prompt)
- Auto-submit on selection

**Source:** Session entries (RunEntry, InputEntry)

#### Phase 6b: Tab Completion
**Shipped:** `5647c3b`

- Context-aware Tab completion
- Command names after `:`
- Harness names after `:harness `
- Model names after `:model `
- Tool names after `:revoke `
- Shift+Tab for backwards navigation
- Non-modal (doesn't block normal typing)

**Infrastructure:**
- `libs/agent-core/src/commands/completion.ts` (portable logic)
- `useCompletions` hook (session-aware)
- `CompletionMenu` component (popup below input)

#### Phase 6c: Improved :help Overlay
**Shipped:** `3c9770e`

- Categorized command reference (Control, Navigation, Information, Session)
- Keyboard shortcuts with platform-aware formatting
- Search/filter functionality
- Tips section

**Backwards compatible:** Falls back to transcript if overlay unavailable

**Status:** All planned ergonomics features complete

---

## Documentation ✅
**Updated:** `debd428` - 2026-09-29

- `packages/code/AGENTS.md` fully updated with all new features
- Structure table updated with overlay/ directory
- Comprehensive command reference
- Feature descriptions with implementation notes

---

## Real Cost Tracking ✅
**Implemented:** 2026-09-29

`:cost` overlay now displays real token usage and cost data from the backend.

**Implementation:**
- Calls `GetModelCost(roomId=["..."])` Pixel to fetch usage data
- Displays per-model breakdown: input/output tokens, API calls, estimated cost
- Shows aggregate totals across all models in the room
- Handles unpriced models (self-hosted, missing catalog rates)
- Empty state for rooms with no usage yet

**Data source:** Backend's `GetModelCostReactor` queries `ModelInferenceLogsDatabase` MESSAGE table for token counts, calculates costs via `ModelCostCalculator` using published rates from `MODELMETADATA.PRICING`

**Scope:** Room-level only (not per-run) — MESSAGE table has no RUN_ID column, so per-run aggregation would require parsing every message payload

**Status:** Fully functional. Status bar cost accumulator can now be implemented using the same data source.

---

## What's Next

### High Priority
1. **Real implementations for placeholders**:
   - `:files` — Real file browser (currently hardcoded tree)
     - Integration with file system or SDK asset APIs
     - Tree navigation, file preview
   - Status bar — Real values (currently `$0.00`, `0%`, `—`)
     - Cost accumulator (depends on `:cost` data)
     - Context window percentage from session
     - Git branch detection

2. **Testing and polish**:
   - Manual testing in dev server
   - Integration tests for overlays
   - Edge cases (empty states, errors, long lists)
   - Performance testing (large diffs, long histories)

3. **Accessibility audit**:
   - Screen reader testing for overlays
   - Keyboard navigation verification
   - Focus management on open/close
   - ARIA labels and roles

### Medium Priority
4. **Enhanced functionality**:
   - `:diff` — Better syntax highlighting, line numbers
   - `:runs` — Click to view full transcript of past run
   - `:packs` — Show tool details when clicking pack
   - `:files` — File operations (open, copy path, etc.)
   - History search — More sophisticated ranking/scoring

5. **Completion enhancements**:
   - File path completion
   - More context-aware providers
   - Inline ghost text for single match
   - Completion cache for performance

### Low Priority
6. **Phase 6d: Keybinding persistence** (optional)
   - User-customizable keyboard shortcuts
   - localStorage persistence
   - Keybinding editor UI
   - Noted as optional/future in design docs

7. **Additional overlays** (if needed):
   - `:logs` — Application logs viewer
   - `:settings` — Console settings
   - `:about` — Version/environment info

---

## Architecture Decisions

### Overlay Pattern (Phase 4)
- Full-screen `OverlayContainer` component
- Dismissed with `q` or Escape
- `onShowOverlay` callback from session commands to console state
- Radix Dialog primitive for accessibility
- Consistent header/content/footer structure

### Ergonomics (Phase 6)
- Completion logic in agent-core (portable)
- UI components in code package
- Platform detection for keyboard formatting
- Non-modal interactions (don't block normal workflow)
- Search/filter as first-class feature

### Data Sources
- **History**: `session.getState().entries`
- **Commands**: `session.commands.commands`
- **Catalog**: `session.getState().catalog` (harnesses, models)
- **Keys**: `DEFAULT_KEYMAP` from agent-core

---

## Known Issues

1. **Status bar placeholders**: All show static values (cost, context, branch)
2. **:files placeholder**: Hardcoded tree, not connected to real file system
3. **:inbox placeholder**: Roadmap-only, no real notification system
4. **Type errors**: 14 baseline errors in `libs/shared` (not in this package)
5. **Home node_modules leak**: Undeclared workspace deps resolve from ~/node_modules on dev machine

---

## Technical Debt

1. **File browser API**: Determine whether to use SDK asset APIs or shell commands
2. **Context tracking**: Need to expose context window usage from session or backend
3. **Git integration**: Branch detection, status polling for status bar

---

## Metrics

- **Total commits (Phases 4-6)**: 8
- **Files created**: 20+
- **Lines added**: ~3,500
- **Tests**: 388 agent-core, 131 code package (all passing)
- **Type errors**: 0 new (22 baseline in shared)
- **CI status**: All phases green

---

## Next Session Recommendations

1. **Start with `:files` real implementation**:
   - Simplest to implement (file system APIs available)
   - High user value (actual browsing vs placeholder)
   - Can use SDK `GetAppAssets` or Bash `find`/`ls`

2. **Then `:cost` tracking**:
   - Requires backend instrumentation or RunEntry extension
   - Need to decide where token counts live
   - Medium complexity

3. **Status bar polish**:
   - Git branch: Easy (shell command)
   - Context %: Medium (need session API)
   - Cost: Depends on #2

4. **Testing pass**:
   - Manual QA of all overlays
   - Edge case verification
   - Performance testing

---

## Resources

- **Design docs**: 
  - `packages/code/PHASE-4-OVERLAYS.md`
  - `packages/code/PHASE-6-ERGONOMICS.md`
- **Main documentation**: `packages/code/AGENTS.md`
- **Upstream tracking**: `FORK.md` at workspace root

---

**Last updated:** 2026-09-29  
**Current commit:** `debd428`  
**Branch:** `dev`  
**Fork:** `vj4p/semoss-ui`
