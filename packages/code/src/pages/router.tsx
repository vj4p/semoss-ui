import { createBrowserRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";
import { AgentsPage } from "./agents.page";
import { AuthenticatedLayout } from "./authenticated.layout";
import { ConsolePage } from "./console.page";
import { ErrorPage } from "./error.page";
import { InitializedLayout } from "./initialized.layout";
import { LoginPage } from "./login.page";
import { MCPPage } from "./mcp.page";
import { SettingsPage } from "./settings.page";

const router = createBrowserRouter([
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
					{ path: "/settings", element: <SettingsPage /> },
					{ path: "/agents", element: <AgentsPage /> },
					{ path: "/mcp", element: <MCPPage /> },
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
 * - `/settings` for configuration
 * - `/agents` for agent harness management
 * - `/mcp` for MCP tools management
 * - `/login` for authentication
 *
 * @name Router
 */
export const Router = () => <RouterProvider router={router} />;
