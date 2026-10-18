import { CheckIcon, LayoutGridIcon } from "lucide-react";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@semoss/ui/next";
import { isEmbedded } from "@semoss/utility/browser";

export interface AppSwitcherApp {
	id: string;
	name: string;
	/** Directory under `/packages/` that the app is served from. */
	dir: string;
}

export const APP_SWITCHER_APPS = [
	{ id: "client", name: "Home", dir: "client" },
	{ id: "playground", name: "Playground", dir: "playground" },
	{ id: "harness", name: "Harness", dir: "harness" },
	{ id: "code", name: "Code", dir: "code" },
	{ id: "terminal", name: "Terminal", dir: "terminal" },
	{ id: "bi", name: "BI", dir: "legacy" },
	{
		id: "browser-automation",
		name: "Browser Automation",
		dir: "browser-automation",
	},
] as const satisfies readonly AppSwitcherApp[];

export type AppSwitcherId = (typeof APP_SWITCHER_APPS)[number]["id"];

const DEPLOYED_PATH = /\/packages\/[^/]+\/dist\/.*$/;

/**
 * The URL of a sibling app, built from the current page's path so it works
 * behind any context path. Outside a deployed path (a dev server) it falls
 * back to the sibling-relative link the platform's own cards use.
 */
export const appHref = (pathname: string, dir: string): string =>
	DEPLOYED_PATH.test(pathname)
		? pathname.replace(DEPLOYED_PATH, `/packages/${dir}/dist/`)
		: `../../${dir}/dist/`;

export interface AppSwitcherLabels {
	trigger: string;
}

export interface AppSwitcherProps {
	current: AppSwitcherId;
	/** Defaults to the page's path; passed in by tests. */
	pathname?: string;
	/** Defaults to `isEmbedded()`; passed in by tests. */
	embedded?: boolean;
	labels?: Partial<AppSwitcherLabels>;
}

/**
 * A menu of links to the platform's apps. Each app is a separate bundle, so the
 * links are plain anchors; they share the session cookie, so no new sign-in.
 * It renders nothing inside a frame, where the host app already has its chrome.
 */
export function AppSwitcher({
	current,
	pathname = typeof window === "undefined" ? "/" : window.location.pathname,
	embedded = isEmbedded(),
	labels,
}: AppSwitcherProps) {
	if (embedded) {
		return null;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label={labels?.trigger ?? "Apps"}
				>
					<LayoutGridIcon aria-hidden />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-48">
				{APP_SWITCHER_APPS.map((app) => (
					<DropdownMenuItem key={app.id} asChild>
						<a
							href={appHref(pathname, app.dir)}
							aria-current={
								app.id === current ? "page" : undefined
							}
						>
							<span className="flex-1">{app.name}</span>
							{app.id === current && (
								<CheckIcon aria-hidden className="size-4" />
							)}
						</a>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
