# AGENTS.md - @semoss/harness

> **Inherits from:** [../../AGENTS.md](../../AGENTS.md) and [../../DESIGN.md](../../DESIGN.md).

The agent room app (a fork-only package; see `FORK.md`). It copies code with `@semoss/playground`
(neither imports the other), so a change to a shared screen usually needs making in both.

## Theme, sign-in and shell (UI refresh)

- The header holds `AppSwitcher`, an **Appearance** control (`ThemeToggle`: light/dark/system) and an
  **Accent color** picker (the six-accent `ThemePicker`, a Harness-only option; its `--ring` is fully
  opaque so focus stays visible). The picker does not hold the mode.
- The composer surface is `composerSurfaceClass` from `@semoss/ui/next`, shared with Playground; do not
  pass a background through `className`.
- A tool call waiting for approval shows **Review and approve** (`ReviewApprovalButton`), which only
  opens the tool panel. Execute Tool and Cancel stay in that panel; Harness has no approval hotkeys.
- Run status in the inbox uses the shared `StatusBadge`.
- Sign-in uses `LoginShell`; the default logo is inverted in dark mode.
