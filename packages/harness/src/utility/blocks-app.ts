/**
 * Authoring a SEMOSS **BLOCKS** app as JSON.
 *
 * A blocks app is one file — `portals/blocks.json` — holding
 * `{version, blocks, queries, variables, executionOrder}`. The client renders it
 * from `GetAppBlocksJson`; nothing is served statically, so unlike a CODE project
 * a blocks app has no URL of its own and only opens at `#/app/{id}/view`.
 *
 * This is worth an agent's while because it is the difference between a page of
 * hand-written HTML and a real app: 42 registered widgets, data grids and charts
 * that bind to a live frame, and cells that run SQL or Python to produce that
 * frame. The platform already generates these programmatically from a form
 * (`packages/client/src/components/prompt/prompt.helpers.ts`), so the format is a
 * supported target, not a reverse-engineered one.
 */

/**
 * The state version to emit.
 *
 * Mirrors `STATE_VERSION` in `libs/renderer/src/version.ts`. Hardcoded rather than
 * imported because the harness does not depend on `@semoss/renderer` and pulling
 * it in for one string would drag the whole renderer barrel along — the same
 * trade-off `prompt.helpers.ts` makes.
 *
 * Drift is safe in one direction only. The client runs migrations forward on load,
 * so a state written at an older version is upgraded automatically; a state
 * claiming a version *newer* than the client knows throws "No migration
 * available". Never raise this past the renderer's own constant.
 */
export const BLOCKS_STATE_VERSION = "1.0.0-alpha.17";

/**
 * A minimal, valid, visibly-working blocks app.
 *
 * One page holding one text block. The point is that it renders something
 * immediately — an empty `blocks` map produces a blank screen that is
 * indistinguishable from a broken app, which is a bad place to start debugging
 * from.
 *
 * `queries`, `variables` and `executionOrder` are present and empty because the
 * Java side (`NotebookHelper`) requires `variables` to exist, and because an
 * agent editing the file should see the keys it is meant to fill in rather than
 * having to know they exist.
 *
 * @param appName - shown as the heading, so a fresh app is identifiable.
 */
export const starterBlocksState = (appName: string): string =>
	JSON.stringify(
		{
			version: BLOCKS_STATE_VERSION,
			executionOrder: [],
			queries: {},
			variables: {},
			blocks: {
				"page-1": {
					id: "page-1",
					widget: "page",
					parent: null,
					data: {
						style: {
							display: "flex",
							flexDirection: "column",
							padding: "24px",
							gap: "8px",
							fontFamily: "roboto",
						},
						loading: false,
					},
					listeners: { onPageLoad: { type: "sync", order: [] } },
					slots: {
						content: { name: "content", children: ["text-1"] },
					},
				},
				"text-1": {
					id: "text-1",
					widget: "text",
					parent: { id: "page-1", slot: "content" },
					data: {
						style: { fontSize: "1.25rem", fontWeight: 600 },
						text: appName,
						show: "true",
						loading: false,
					},
					listeners: {},
					slots: {},
				},
			},
		},
		null,
		2,
	);

/**
 * The `AGENTS.md` dropped into a new BLOCKS project.
 *
 * Everything here is something an agent cannot discover from the filesystem and
 * would otherwise get wrong. The traps are specific and each one produces a
 * silently blank app rather than an error, because the backend validates only that
 * the file is parseable JSON — a bad widget name is not caught until the renderer
 * throws at view time.
 *
 * @param projectId - the project's id, for the view URL.
 * @param projectName - shown as the document title.
 */
export const blocksProjectAgentsMd = (
	projectId: string,
	projectName: string,
): string => `# ${projectName}

A SEMOSS **BLOCKS** app. The whole app is one file:

\`\`\`
portals/blocks.json
\`\`\`

Edit that file to build the app. There is no HTML, CSS or JS — the platform
renders the JSON. Open the app at \`#/app/${projectId}/view\`.

## The shape

\`\`\`json
{
  "version": "${BLOCKS_STATE_VERSION}",
  "blocks":   { "<id>": { "id", "widget", "parent", "data", "listeners", "slots" } },
  "queries":  { "<notebookId>": { "id", "cells": [ { "id", "widget", "parameters" } ] } },
  "variables": {},
  "executionOrder": []
}
\`\`\`

\`blocks\` is a **flat map**, not a tree. Nesting is expressed twice and both
directions must agree: a child names its parent as
\`"parent": {"id": "page-1", "slot": "content"}\`, and the parent lists the child in
\`"slots": {"content": {"name": "content", "children": ["child-id"]}}\`.

## Rules that will cost you an afternoon

- **Widget names must be exact.** An unknown \`widget\` throws at render time, so the
  app looks fine until someone opens it. Common ones: \`page\`, \`container\`, \`text\`,
  \`markdown\`, \`grid\`, \`e-chart\`, \`input\`, \`select\`, \`button\`, \`form\`, \`tab\`,
  \`image\`, \`iframe\`, \`divider\`.
- **The key is \`queries\`, not \`notebooks\`.** The browser reads only \`queries\`. Some
  platform code uses the other name internally; on disk it is \`queries\`.
- **The message name is \`RUN_QUERY\`, not \`RUN_NOTEBOOK\`.** The action constants kept
  their old wire values.
- **Do not raise \`version\`.** \`${BLOCKS_STATE_VERSION}\` is what this client
  understands. Older is migrated forward automatically; newer throws.
- **A grid or chart binds to a frame by name**, via \`data.frame.name\`. Leave
  \`data.columns\` as \`[]\` and the grid fills them in from the frame itself.
- Nothing runs unless the page asks it to. Put a \`RUN_QUERY\` in the page block's
  \`onPageLoad\` listener.

## A data-bound page, end to end

\`\`\`json
{
  "version": "${BLOCKS_STATE_VERSION}",
  "executionOrder": ["nb1"],
  "variables": {},
  "queries": {
    "nb1": { "id": "nb1", "cells": [ {
      "id": "c1", "widget": "query-import",
      "parameters": {
        "databaseId": "<DATABASE_ENGINE_ID>",
        "frameType": "PY",
        "frameVariableName": "df",
        "selectQuery": "SELECT dept, SUM(amt) AS total FROM spend GROUP BY dept"
      } } ] }
  },
  "blocks": {
    "page-1": { "id": "page-1", "widget": "page", "parent": null,
      "data": { "style": { "display": "flex", "flexDirection": "column", "padding": "24px" } },
      "listeners": { "onPageLoad": { "type": "sync",
        "order": [ { "message": "RUN_QUERY", "payload": { "queryId": "nb1" } } ] } },
      "slots": { "content": { "name": "content", "children": ["grid-1"] } } },
    "grid-1": { "id": "grid-1", "widget": "grid", "parent": { "id": "page-1", "slot": "content" },
      "data": { "frame": { "name": "df" }, "columns": [], "view": { "pagination": true },
                "style": { "width": "100%", "height": "400px" }, "show": true },
      "listeners": {}, "slots": {} }
  }
}
\`\`\`

Use a real engine id for \`databaseId\` — the ids available to this project are
listed under "Selected Engines" in your instructions. If none are listed, say so
and ask for one rather than guessing.

## Saving

Writing \`portals/blocks.json\` directly works. Prefer
\`SaveAppBlocksJson(project=["${projectId}"], json=["..."], comment=["..."])\` when
you have it — that also commits to the project's git history and refreshes what
the viewer serves.

Project id: \`${projectId}\`
`;
