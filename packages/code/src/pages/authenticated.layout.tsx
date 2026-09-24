import { Navigate, Outlet, useLocation } from "react-router";
import { useInsight } from "@semoss/sdk/react";

/**
 * Sends a user who is not signed in to the login page, which brings them
 * back here once they are.
 *
 * @name AuthenticatedLayout
 */
export const AuthenticatedLayout = () => {
	const { isAuthorized } = useInsight();
	const location = useLocation();

	if (!isAuthorized) {
		return <Navigate to="/login" state={{ from: location }} replace />;
	}
	return <Outlet />;
};
