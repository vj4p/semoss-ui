import { createHashRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";
import { AuthenticatedLayout } from "./authenticated.layout";
import { ConsolePage } from "./console.page";
import { ErrorPage } from "./error.page";
import { InitializedLayout } from "./initialized.layout";
import { LoginPage } from "./login.page";

const router = createHashRouter([
	{
		element: <InitializedLayout />,
		errorElement: <ErrorPage />,
		children: [
			{
				element: <AuthenticatedLayout />,
				children: [
					{
						path: "/",
						element: <ConsolePage />,
						// The page reads the room from these. They draw nothing,
						// so that moving between them keeps the page mounted.
						children: [
							{ index: true, element: null },
							{ path: "room/:roomId", element: null },
						],
					},
				],
			},
			{ path: "/login", element: <LoginPage /> },
			{ path: "*", element: <Navigate to="/" replace /> },
		],
	},
]);

/**
 * The console's routes:
 * - `/` for a new room
 * - `/room/:roomId` for an existing room
 * - `/login` for authentication
 *
 * Configuration, agent harness, and MCP tools are accessed via commands
 * (:settings, :agent, :mcp) which open overlays, not URL routes.
 *
 * @name Router
 */
export const Router = () => <RouterProvider router={router} />;
