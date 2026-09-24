import { Navigate, useLocation } from "react-router";
import { useInsight } from "@semoss/sdk/react";
import { LoginForm } from "@semoss/shared";

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
 * No heading of its own: the form has the page's. Centred while it fits,
 * and from the top once it does not, so that zoom cannot push the top of the
 * form out of reach.
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
		<main className="items-center-safe justify-center-safe flex h-full overflow-y-auto bg-background p-6 text-foreground">
			<div className="w-full max-w-xs">
				<LoginForm />
			</div>
		</main>
	);
};
