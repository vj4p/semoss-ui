import { observer } from "mobx-react-lite";
import { Navigate, useLocation } from "react-router";
import { useInsight } from "@semoss/sdk/react";
import { LoginForm, LoginShell } from "@semoss/shared";
import loginBackground from "@/assets/img/login-background.svg";
import { AppLogo } from "@/components/app-logo";

/**
 * LoginPage
 */
export const LoginPage = observer(() => {
	const { isAuthorized } = useInsight();
	const location = useLocation();
	// get the path the user is coming from
	const path = (location.state as { from: Location })?.from?.pathname || "/";

	// navigate if already logged in
	if (isAuthorized) {
		return <Navigate to={path} replace />;
	}

	return (
		<LoginShell brand={<AppLogo />} heroSrc={loginBackground}>
			<LoginForm />
		</LoginShell>
	);
});
