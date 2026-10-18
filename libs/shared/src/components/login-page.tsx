import type { ReactNode } from "react";
import { useInsight } from "@semoss/sdk/react";
import { Spinner, useTheme } from "@semoss/ui/next";
import { LoginForm } from "./form/login-form";
import { LoginShell } from "./login-shell";

interface LoginPageProps {
	/**
	 * Branding to show above the form on the left column (logo, app name).
	 * Optional — omit if you don't want the top branding row at all.
	 */
	branding?: ReactNode;

	/**
	 * Right-column hero image (shown only on `lg+` viewports). When neither
	 * `imageSrc` nor `imageSrcDark` is provided, the right column is dropped
	 * entirely and the form fills the screen.
	 */
	imageSrc?: string;
	/** Dark-mode variant of `imageSrc`. Falls back to `imageSrc` when unset. */
	imageSrcDark?: string;

	/**
	 * Content rendered once the user is authorized — i.e. the actual app.
	 * While not authorized, the login screen is shown instead.
	 */
	children: ReactNode;
}

/**
 * Drop-in auth gate. Wrap your app's root with this and the user will see the
 * shared login form until `useInsight().isAuthorized` flips to true, at which
 * point the wrapped children render.
 *
 * Must be mounted inside an `<InsightProvider>` (so `LoginForm` can call
 * `actions.login(...)`).
 *
 * Example:
 *
 *     <InsightProvider>
 *       <ThemeProvider defaultTheme="system" storageKey="...">
 *         <LoginPage branding={<AppLogo />} imageSrc={...}>
 *           <YourApp />
 *         </LoginPage>
 *       </ThemeProvider>
 *     </InsightProvider>
 */
export const LoginPage = ({
	branding,
	imageSrc,
	imageSrcDark,
	children,
}: LoginPageProps) => {
	const { isInitialized, isAuthorized } = useInsight();
	const { theme: colorMode } = useTheme();

	// While the insight is still bootstrapping (figuring out auth state)
	// show a centered spinner so the page doesn't flash login + then app.
	if (!isInitialized) {
		return (
			<div className="flex h-svh w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	if (isAuthorized) {
		return <>{children}</>;
	}

	const isDark =
		colorMode === "dark" ||
		(colorMode === "system" &&
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);
	const resolvedImage = isDark ? imageSrcDark || imageSrc : imageSrc;

	return (
		<LoginShell brand={branding} heroSrc={resolvedImage}>
			<LoginForm />
		</LoginShell>
	);
};
