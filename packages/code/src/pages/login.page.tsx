import { Navigate, useLocation } from "react-router";
import { useInsight } from "@semoss/sdk/react";
import { LoginForm, LoginShell } from "@semoss/shared";

/**
 * Where the login page was sent from, which is where to go once signed in.
 *
 * @name fromPath
 * @param state - The location state `AuthenticatedLayout` navigates with.
 * @return That location's path, or the console's.
 */
const fromPath = (state: unknown): string => {
	if (typeof state === "object" && state !== null && "from" in state) {
		const { from } = state;
		if (
			typeof from === "object" &&
			from !== null &&
			"pathname" in from &&
			typeof from.pathname === "string"
		) {
			return from.pathname;
		}
	}
	return "/";
};

/**
 * The platform's login form, and a way back to where the user was going.
 *
 * No heading of its own: the form has the page's. The shell grows with its
 * content, so zoom scrolls the page instead of clipping the form.
 *
 * @name LoginPage
 */
export const LoginPage = () => {
	const { isAuthorized } = useInsight();
	const location = useLocation();

	if (isAuthorized) {
		return <Navigate to={fromPath(location.state)} replace />;
	}
	return (
		<LoginShell brand={<span className="font-mono">SEMOSS Code</span>}>
			<LoginForm />
		</LoginShell>
	);
};
