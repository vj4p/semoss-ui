import {
	I18nBuilder,
	I18nextProvider,
	playgroundResources,
	terminalResources,
} from "@semoss/i18n";
import { Env, InsightProvider } from "@semoss/sdk/react";
import { ThemeProvider, Toaster } from "@semoss/ui/next";
import { LandscapeRestriction } from "@/components/common/landscape-restriction";
import { Router } from "@/pages";

// use the environment variable to set the module
Env.update({
	MODULE: import.meta.env.MODULE || "/Monolith",
	ACCESS_KEY: import.meta.env.ACCESS_KEY,
	SECRET_KEY: import.meta.env.SECRET_KEY,
});

// create a new i18n instance for the harness (reusing playground resources,
// plus the embedded terminal's namespaces). playgroundResources doesn't carry
// them because Playground has no terminal; without them the console renders
// raw keys like "run.button". Registered in `load` but left out of `ns` so they
// are fetched only when the terminal panel actually mounts — the same split the
// client uses for the same component.
const i18nBuilder = new I18nBuilder({
	...playgroundResources,
	// terminalResources already owns the correct loaders, so borrow its `load`
	// rather than restating paths that only resolve inside libs/i18n.
	// playgroundResources goes last so its own namespaces win on any overlap.
	load: { ...terminalResources.load, ...playgroundResources.load },
});
const i18n = i18nBuilder.i18n;

// Awaited by main.tsx before the first render so the active language is present.
export const i18nReady = i18nBuilder.ready;

export const App = () => {
	return (
		<I18nextProvider i18n={i18n}>
			<InsightProvider>
				<ThemeProvider
					defaultTheme="light"
					storageKey="smss-ui-theme-harness"
				>
					<LandscapeRestriction />
					<div className="absolute inset-0 h-screen w-screen overflow-hidden">
						<Router />
					</div>
					<Toaster position="top-center" />
				</ThemeProvider>
			</InsightProvider>
		</I18nextProvider>
	);
};
