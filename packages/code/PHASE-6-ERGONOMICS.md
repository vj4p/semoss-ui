# Phase 6: Terminal Ergonomics — Design

## Overview

Improve terminal usability with keyboard shortcuts, search, completion, and persistence. Make the console feel like a professional developer tool.

**Goal**: Match ergonomics of established terminals (fish, zsh, fzf) within the browser constraints.

## Features

### 6a: History Search (Ctrl+R)

Fuzzy search through command/prompt history with keyboard navigation:
- Trigger with `Ctrl+R` (or `Cmd+R` on Mac)
- Overlay search interface (similar to fzf)
- Shows matching items as you type
- Arrow keys to navigate, Enter to select
- Escape to dismiss
- Searches both commands (`:help`) and prompts

**Implementation**:
- New `HistorySearchOverlay` component
- Uses existing `useHistory` hook from agent-core
- Fuzzy match with highlighting (basic substring for now)
- Session keyboard binding for Ctrl+R

### 6b: Command Completion

Tab completion for commands and their arguments:
- Press Tab after `:` to complete command names
- Press Tab after command to complete arguments (file paths, model names, etc.)
- Shows completion menu if multiple matches
- Inline suggestion (ghost text) for single match

**Implementation**:
- Extend `PromptInput` to detect Tab key
- Add completion logic to `SessionCommands`
- Completion providers for different contexts:
  - Commands: list all command names
  - Harness names (after `:harness`)
  - Model names/IDs (after `:model`)
  - Tool names (after `:revoke`)
  - File paths (future: after relevant commands)

### 6c: Improved :help

Better help display with search and categories:
- Categorize commands (navigation, control, overlays, etc.)
- Add keyboard shortcuts to help output
- Search within help (filter by typing)
- Copy command examples

**Implementation**:
- Enhanced help overlay (full-screen, categorized)
- Or keep in transcript but add categories
- Decision: use overlay for consistency with Phase 4

### 6d: Keybinding Persistence

Save user's keybinding preferences:
- Allow customization of keyboard shortcuts
- Persist in localStorage or session preferences
- UI to view/edit bindings (possibly in settings overlay)

**Implementation**:
- Extend keymap system to support user overrides
- Add keybinding editor component
- Save to localStorage, load on init

## Architecture Decisions

### 1. Overlay vs Inline

**History Search**: Overlay (like `:files`, `:diff`)
- Full-screen search experience
- Doesn't clutter transcript
- Familiar pattern from Phase 4

**Completion Menu**: Inline (near cursor)
- Small popup below input
- Contextual to what's being typed
- Non-modal (can dismiss by continuing to type)

**Help**: Overlay (convert from transcript notice)
- Better organization, searchable
- More space for categories and examples
- Consistent with other overlays

### 2. Keyboard Handling

Ctrl+R must work when prompt is focused but not inside Text input on the page.

Challenge: Browser captures some keyboard shortcuts.
- `Ctrl+R`: Browser reload (need to preventDefault)
- `Cmd+R`: Browser reload on Mac (need to preventDefault)
- `Ctrl+T`: Browser new tab (can't capture)

**Solution**: Use `useEffect` on document level, check if input is focused, preventDefault.

### 3. Completion Trigger

Tab key or other?
- Tab: Standard in terminals, but also used for focus navigation
- Option: Only complete if input has text
- Fallback: Use another key (Ctrl+Space) if Tab conflicts

**Decision**: Tab completes if input has text after `:`, otherwise normal focus behavior.

## Implementation Plan

### 6a: History Search (Ctrl+R)

1. **Create HistorySearchOverlay**
   - Similar to FilesOverlay structure
   - Search input at top
   - Filtered list of history items
   - Keyboard navigation (arrow keys, Enter, Escape)

2. **Integrate with Console**
   - Add to console-loader like other overlays
   - Wire up Ctrl+R keyboard shortcut
   - Access session history via `session.getState().history`

3. **Fuzzy Search Logic**
   - Basic substring match for now
   - Highlight matching characters
   - Sort by relevance (most recent first if tie)

### 6b: Command Completion

4. **Add Completion Provider Interface**
   - Define `CompletionProvider` interface in agent-core
   - Providers for: commands, harnesses, models, tools
   - Context-aware selection (what's after `:`)

5. **Update PromptInput**
   - Listen for Tab key
   - Call completion provider based on cursor position
   - Show completion menu (new component)

6. **Completion Menu Component**
   - Small popup positioned below cursor
   - List of completions with descriptions
   - Keyboard navigation
   - Insert on Enter/Tab, dismiss on Escape

### 6c: Improved :help

7. **Create HelpOverlay**
   - Full-screen overlay (not transcript notice)
   - Categorized command list
   - Keyboard shortcuts table
   - Search/filter input

8. **Update :help Command**
   - Call `onShowOverlay("help")` instead of `session.notice()`
   - Keep existing help text generation as data source

### 6d: Keybinding Persistence

9. **Extend Keymap System**
   - Support user overrides in keymap
   - Load from localStorage on init
   - Merge with default keybindings

10. **Settings/Config UI** (optional, or defer to later)
    - UI to view/edit keybindings
    - Could be `:config` or `:settings` overlay
    - For now: document how to customize via dev tools

## Testing Strategy

- Manual testing for keyboard shortcuts (Ctrl+R, Tab completion)
- Unit tests for fuzzy search logic
- Unit tests for completion providers
- Integration test: search, select, execute
- Test on Mac (Cmd) and Windows/Linux (Ctrl)

## Timeline Estimate

- **6a** (history search): ~3-4 hours
- **6b** (completion): ~4-6 hours
- **6c** (improved help): ~2-3 hours
- **6d** (keybinding persistence): ~2-3 hours

**Total**: ~11-16 hours of focused work, probably 3-4 commits.

## Open Questions

1. **Completion menu positioning**: Absolute? Portal? Below input?
2. **History search scoring**: Simple substring or more sophisticated fuzzy match?
3. **Keybinding conflicts**: What if user's OS captures Ctrl+R?
4. **Help overlay vs enhanced transcript**: Overlay for consistency or improve transcript help?

## Next Steps

Start with 6a:
1. Build `HistorySearchOverlay`
2. Wire up Ctrl+R shortcut in Console
3. Implement search/filter logic
4. Test + commit as "feat(code): add Ctrl+R history search"
