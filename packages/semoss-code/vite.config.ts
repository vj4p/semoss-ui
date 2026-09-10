import { resolve } from "node:path";
import {
	createViteConfig,
	DEV_SERVER_PORTS,
	localeManualChunks,
} from "@semoss/config";

export default createViteConfig({
	rootDir: import.meta.dirname,
	port: DEV_SERVER_PORTS.semossCode,
	manualChunks: localeManualChunks,
	alias: [
		// FileEditor (from @semoss/shared) wraps Monaco. libs/shared is
		// consumed at source level, not pre-built, so this app's own Vite
		// bundle needs its own resolve for the bare "monaco-editor" import,
		// same as playground's config does for the same reason.
		{
			find: /^monaco-editor$/,
			replacement: resolve(
				import.meta.dirname,
				"../../libs/shared/node_modules/monaco-editor/esm/vs/editor/editor.api",
			),
		},
	],
	define: (env, isProduction) => ({
		"import.meta.env.ACCESS_KEY": isProduction
			? undefined
			: JSON.stringify(env.ACCESS_KEY),
		"import.meta.env.SECRET_KEY": isProduction
			? undefined
			: JSON.stringify(env.SECRET_KEY),
	}),
});
