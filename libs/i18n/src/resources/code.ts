// SEMOSS Code (the terminal-idiom agent console) lazy translations.
//
// The console's own copy lives in the `code` namespace. The words the shared
// `@semoss/agent-core` session writes into the transcript sit under `code:core.*`,
// so the library keeps its English source of truth and the app supplies the rest.
// Like the audit log it follows the shared `smss-language` value, with English
// fallback.
//
// `room` is deliberately not loaded: harness labels come from the backend's
// `displayName` (via `useAgentHarnesses`), because the non-English `room.json`
// files carry no `harness.*` keys yet. The shared `LoginForm` and
// `AgentUserInputCard` render their own English and need no namespace here.
//
// `mcp` IS loaded (unlike `room`): the `:mcp` overlay renders `@semoss/shared`'s
// `MCPSelector`/`MCPCard`, which call `useTranslation("mcp")` directly and read
// real keys (permission labels, search placeholder, empty-state copy) rather
// than tolerating a missing one the way `useAgentHarnesses` does -- so leaving
// it out leaked literal keys ("permission.owner") into the overlay. Not in
// `ns`: the overlay is opened on demand, not at init, same reasoning as the
// client's embedded terminal namespaces.
import type { LazyResources } from "./types";

export const codeResources: LazyResources = {
	ns: ["common", "notifications", "validation", "code"],
	load: {
		// core
		common: (l) => import(`./locales/${l}/common.json`),
		notifications: (l) => import(`./locales/${l}/notifications.json`),
		validation: (l) => import(`./locales/${l}/validation.json`),
		// shared
		mcp: (l) => import(`./locales/${l}/shared/mcp.json`),
		// code
		code: (l) => import(`./locales/${l}/code/code.json`),
	},
};
