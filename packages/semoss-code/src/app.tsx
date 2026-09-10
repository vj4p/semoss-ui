import { createHashRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { I18nBuilder, I18nextProvider, terminalResources } from "@semoss/i18n";
import { Env, InsightProvider } from "@semoss/sdk/react";
import { LoginPage } from "@semoss/shared";
import { ThemeProvider, Toaster } from "@semoss/ui/next";
import { ProjectPickerPage } from "./pages/project-picker-page";

Env.update({
	MODULE: import.meta.env.MODULE || "/Monolith",
	ACCESS_KEY: import.meta.env.ACCESS_KEY,
	SECRET_KEY: import.meta.env.SECRET_KEY,
});

const i18nBuilder = new I18nBuilder(terminalResources);
export const i18nReady = i18nBuilder.ready;

const router = createHashRouter([
	{
		path: "/",
		element: <ProjectPickerPage />,
	},
	{
		path: "/project/:projectId",
		element: <div>Workspace — coming in Task 7</div>,
	},
]);

export const App = () => (
	<I18nextProvider i18n={i18nBuilder.i18n}>
		<InsightProvider>
			<ThemeProvider
				defaultTheme="light"
				storageKey="smss-ui-theme-semoss-code"
			>
				<LoginPage branding={<div>Semoss Code</div>}>
					<RouterProvider router={router} />
				</LoginPage>
				<Toaster position="top-center" closeButton />
			</ThemeProvider>
		</InsightProvider>
	</I18nextProvider>
);
