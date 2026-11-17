import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import { useSession } from "@semoss/sdk/react";
import { LoginForm, LoginShell } from "@semoss/shared";
import { useTheme } from "@semoss/ui/next";
import { setFavicon } from "@semoss/utility/browser";
import { AppLogo } from "@/components";
import { usePlaygroundTheme } from "@/hooks/use-playground-theme";
import { useThemeTitle } from "@/hooks/use-theme-title";

/**
 * LoginPage
 */
export const LoginPage = () => {
	const theme = usePlaygroundTheme();
	const status = useSession((state) => state.status);
	const { theme: colorMode } = useTheme();

	// theme = dark or system matches dark
	const isDark =
		colorMode === "dark" ||
		(colorMode === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches); // gets system preference

	const location = useLocation();

	// get the path the user is coming from
	const path = (location.state as { from: Location })?.from?.pathname || "/";

	useThemeTitle(theme);

	useEffect(() => {
		const icon = theme?.images?.tabIcon;
		if (icon) setFavicon(icon);
	}, [theme?.images?.tabIcon]);

	// navigate if already logged in
	if (status === "AUTHENTICATED") {
		return <Navigate to={path} replace />;
	}

	// handling the login image source based on theme
	const src = isDark ? theme.images.loginDark : theme.images.login;

	return (
		<LoginShell brand={<AppLogo full={true} />} heroSrc={src}>
			<LoginForm
				resetSubject={`${theme.name?.trim() || "SEMOSS"} Reset Password Request`}
			/>
		</LoginShell>
	);
};
