import { codeResources, I18nBuilder, I18nextProvider } from "@semoss/i18n";
import { Env, InsightProvider } from "@semoss/sdk/react";
import { ThemeProvider, Toaster } from "@semoss/ui/next";
import { Router } from "@/pages";

// use the environment variable to set the module
Env.update({
	MODULE: import.meta.env.MODULE || "/Monolith",
	ACCESS_KEY: import.meta.env.ACCESS_KEY,
	SECRET_KEY: import.meta.env.SECRET_KEY,
});

const i18nBuilder = new I18nBuilder(codeResources);

// Awaited by main.tsx before the first render so the active language is present.
export const i18nReady = i18nBuilder.ready;

export const App = () => (
	<I18nextProvider i18n={i18nBuilder.i18n}>
		<InsightProvider>
			<ThemeProvider storageKey="smss-ui-theme-code">
				<div className="h-svh w-full overflow-hidden">
					<Router />
				</div>
				{/*
					The console reports into its transcript, not in toasts. This is
					for the shared components that only report through one:
					AgentUserInputCard says which question is unanswered, and
					LoginForm confirms an OAuth sign-in.
				*/}
				<Toaster position="top-center" />
			</ThemeProvider>
		</InsightProvider>
	</I18nextProvider>
);
