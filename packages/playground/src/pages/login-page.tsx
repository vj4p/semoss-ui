import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import { useInsight } from "@semoss/sdk/react";
import { LoginForm, LoginShell } from "@semoss/shared";
import { useTheme } from "@semoss/ui/next";
import { setFavicon } from "@semoss/utility/browser";
import { AppLogo } from "@/components";
import { useRoot } from "@/hooks";
import { useThemeTitle } from "@/hooks/use-theme-title";

/**
 * LoginPage
 */
export const LoginPage = observer(() => {
	const { root } = useRoot();
	const theme = root.theme;
	const { isAuthorized } = useInsight();
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
	if (isAuthorized) {
		return <Navigate to={path} replace />;
	}

	// handling the login image source based on theme
	const src = isDark ? root.theme.images.loginDark : root.theme.images.login;

	return (
		<LoginShell brand={<AppLogo full={true} />} heroSrc={src}>
			<LoginForm
				resetSubject={`${theme.name?.trim() || "SEMOSS"} Reset Password Request`}
			/>
		</LoginShell>
	);
});
