import { Env } from "@semoss/sdk";

/**
 * Where a CODE project's app is actually served from.
 *
 * `PublicHomeCheckFilter` is mapped at `/public_home/*` on the Monolith context
 * and serves the project's **`portals/`** folder — nothing else in the project
 * is web-reachable. It publishes on first request and access-checks the project,
 * so this URL 403s for someone who cannot view the project and 404s when
 * `portals/` has no `index.html`.
 *
 * This is also exactly what the platform's own app viewer loads: `ViewAppPage`
 * renders `CodeRenderer`, which is an iframe pointed at this same path. So a
 * file that isn't under `portals/` is invisible to both.
 */
export const portalUrl = (projectId: string): string =>
	`${window.location.origin}${Env.MODULE}/public_home/${projectId}/portals/`;

/**
 * The app inside the platform UI (breadcrumbs, share, edit), if we can work out
 * where the client app is served from.
 *
 * There is no config value for this — `Env` carries `MODULE` (the API context)
 * and `APP`, not a client base — so it has to be derived from where this bundle
 * itself is being served:
 *
 * - dev/preview builds live at `/packages/<app>/dist/`, so swapping the app
 *   segment finds the sibling client build;
 * - in a real deployment `server.xml` gives ROOT to the client SPA, so `/` is
 *   correct.
 *
 * Returns null rather than guessing when the path matches neither shape — a
 * wrong link is worse than no link, and {@link portalUrl} always works.
 */
export const platformAppUrl = (projectId: string): string | null => {
	const { origin, pathname } = window.location;
	const view = `#/app/${projectId}/view`;

	const packaged = pathname.match(/^(.*)\/packages\/[^/]+\/dist\//);
	if (packaged) {
		return `${origin}${packaged[1]}/packages/client/dist/${view}`;
	}

	// Served from a path we don't recognise as a package build — only ROOT is a
	// safe assumption, and only when we're not sitting in some sub-path.
	if (pathname === "/" || pathname.startsWith("/index.html")) {
		return `${origin}/${view}`;
	}

	return null;
};

/**
 * The `AGENTS.md` dropped into a new CODE project.
 *
 * `AgentsMdLoader` reads `AGENTS.md` (or `CLAUDE.md`) from the agent's working
 * directory — which for a project-scoped room is this project's assets folder —
 * and appends it to the system prompt. That makes it the one place where a
 * project can tell an agent its own conventions, without touching the agent's
 * instructions or the harness prompt.
 *
 * It exists because both things an agent needs to know here are otherwise
 * undiscoverable from the filesystem: that `portals/` is the only served
 * directory, and what URL the finished app has. Without it an agent writes
 * `index.html` to the assets root, reports success, and produces an app that
 * nothing can open.
 */
export const projectAgentsMd = (
	projectId: string,
	projectName: string,
): string => {
	const platform = platformAppUrl(projectId);
	return `# ${projectName}

A SEMOSS **CODE** project. You are working in its \`app_root/version/assets\`
folder, which is git-backed — writes here are the app.

## Web files must live in \`portals/\`

\`portals/\` is the **only** directory that is served over HTTP. \`portals/index.html\`
is the entry point.

- Put every HTML/CSS/JS file for the app under \`portals/\`.
- A file written to the assets root is **not reachable** — no URL serves it. If
  you put \`index.html\` here instead of \`portals/index.html\`, the app looks
  finished and opens as a blank page.
- Reference sibling files with relative paths (\`<script src="app.js">\`), never
  absolute ones.

## Where this app opens

${platform ? `- In SEMOSS: ${platform}\n` : ""}- Directly: ${portalUrl(projectId)}

Give the user one of these links when you finish, or when they ask where the app
is. Do **not** offer a \`file://\` path: this code runs inside a container, so a
container path is meaningless in their browser.

Project id: \`${projectId}\`
`;
};
