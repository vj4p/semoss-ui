import type { ConfigEnv } from "vite";
import { resolve } from "node:path";
import {
	createViteConfig,
	DEV_SERVER_PORTS,
	localeManualChunks,
} from "@semoss/config";
import { aiSdkStubAlias, scopePptxViewerCssPlugin } from "@semoss/panels/vite";

const baseConfig = createViteConfig({
	rootDir: import.meta.dirname,
	port: DEV_SERVER_PORTS.harness,
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
		// pptx-react-viewer declares "ai" as an optional peer for a chat panel
		// this app never renders, but the bundler still resolves its named
		// imports, so the build fails outright without the stub. Same reason
		// client, playground and terminal carry it.
		aiSdkStubAlias,
	],
	define: (env, isProduction) => ({
		"import.meta.env.ACCESS_KEY": isProduction
			? undefined
			: JSON.stringify(env.ACCESS_KEY),
		"import.meta.env.SECRET_KEY": isProduction
			? undefined
			: JSON.stringify(env.SECRET_KEY),
	}),
	// Without this the suite has no jest-dom matchers and every
	// toBeInTheDocument assertion fails as "Invalid Chai property", which is
	// how this package's tests have behaved since it was forked. Also supplies
	// the ResizeObserver and canvas stubs jsdom lacks.
	test: {
		setupFiles: "./vitest.setup.ts",
	},
});

// This app renders the pptx viewer (file previews and message attachments), so
// it needs the viewer's CSS scoped the same way playground does — the library
// ships unscoped global styles that otherwise leak into the whole app.
export default (env: ConfigEnv) => {
	const config = baseConfig(env);
	config.plugins = [scopePptxViewerCssPlugin, ...(config.plugins ?? [])];
	return config;
};
