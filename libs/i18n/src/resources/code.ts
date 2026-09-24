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
import type { LazyResources } from "./types";

export const codeResources: LazyResources = {
	ns: ["common", "notifications", "validation", "code"],
	load: {
		// core
		common: (l) => import(`./locales/${l}/common.json`),
		notifications: (l) => import(`./locales/${l}/notifications.json`),
		validation: (l) => import(`./locales/${l}/validation.json`),
		// code
		code: (l) => import(`./locales/${l}/code/code.json`),
	},
};
