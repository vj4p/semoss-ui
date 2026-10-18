# BI skin

Gives the prebuilt BI app (`packages/legacy`, served at `/packages/legacy/dist/`) the platform's
colors, type and dark theme without changing its code. BI's source is not in this workspace and it
is baked into the Docker image, so it cannot be rebuilt or restyled in the usual way.

## How it works

BI draws its own components (`smss-btn`, `smss-input`, `smss-card`, and the rest) from 27 CSS
variables on `:root`. `bi-skin.css` redefines them (`html:root`, one step more specific than BI's
`:root`), once for light and once for `html[data-theme="dark"]`. The platform's values are used:
`#0560D8` primary, contrast-safe greys, Geist.

`bi-skin.js` runs in `<head>` and keeps BI in step with the platform:

- It reads the shared choice in `localStorage["smss-ui-theme"]` (light, dark or system), adopts a
  choice stored under an app's old key, follows changes from other tabs and apps, and follows the OS
  for system.
- It adds a Light / Dark / System switch on the sign-in screen, where BI has no menu to hold one.
- `localStorage.setItem("smss-bi-skin", "off")` and a reload removes the skin without touching BI.

BI's dashboard builder lets a widget set these same variables inline. Those values are closer than
`:root`, so colors users chose in their own dashboards are kept.

## Files

| File | Purpose |
|---|---|
| `bi-skin.css` | The variable sets and a few fixes: font, visible focus ring, 8/12px radii, headline color, dark logo |
| `bi-skin.js` | Theme following, the sign-in switch, the off switch |
| `fonts/` | Geist (Latin and Latin Extended), so BI needs no CDN |
| `index.original.html` | BI's stock `index.html`, kept so applying and rolling back are repeatable |
| `deploy-local.sh` | `apply` / `rollback` against the local Docker stack |
| `skin.test.mjs` | Contrast of every pairing in both themes, and the script's behavior |

## Use

```bash
node --test skins/bi/skin.test.mjs      # contrast and behavior
skins/bi/deploy-local.sh apply          # patch the running local container
skins/bi/deploy-local.sh rollback       # restore BI's original page
```

BI is not bind-mounted like the other apps, so `apply` copies into the container. A container that
is recreated, not just restarted, loses the change; run `apply` again. For a deployment that is not
this local stack, copy `bi-skin.css`, `bi-skin.js` and `fonts/` to `packages/legacy/skin/` and add
these to BI's `index.html`, after the `core.*.css` link:

```html
<link id="bi-skin-css" href="../skin/bi-skin.css" rel="stylesheet">
<script src="../skin/bi-skin.js"></script>
```

## Limits

- ag-grid tables and charts use fixed colors, so they stay light in the dark theme.
- Dashboard panels style their own headers inline (a white tab with blue text by default, which is
  BI's own 2.73:1) and are user-configurable, so the skin leaves them alone. A panel stays light in
  the dark theme unless its author themed it. The top bar, the welcome cards and banner, and grids are kept on
  the light palette on purpose ("light islands" in `bi-skin.css`).
- BI's signed-in screens (home, catalog, dashboard builder) have only been reasoned about from its
  stylesheet, not viewed. Report anything unreadable in dark mode; the off switch above is the fast
  way out.
- The sign-in switch is the only theme control inside BI. Elsewhere, change the theme in another
  platform app and BI follows.
