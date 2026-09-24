import { resolve } from "node:path";
import {
	createViteConfig,
	DEV_SERVER_PORTS,
	localeManualChunks,
} from "@semoss/config";

export default createViteConfig({
	rootDir: import.meta.dirname,
	port: DEV_SERVER_PORTS.code,
	manualChunks: localeManualChunks,
	alias: [
		// The @semoss/shared barrel re-exports FileEditor, which wraps Monaco.
		// libs/shared is consumed at source level, so this bundle resolves the
		// bare "monaco-editor" import itself, to the API-only entry the other
		// apps use, even though the console never renders an editor.
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
	// jest-dom's matchers and the ResizeObserver stub jsdom lacks.
	test: {
		setupFiles: "./vitest.setup.ts",
	},
});
