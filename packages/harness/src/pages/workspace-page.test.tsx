import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspacePage } from "./workspace-page";

const mocks = vi.hoisted(() => ({
	list: {
		data: [] as unknown[],
		totalCount: 0,
		isError: false,
		error: null as Error | null,
		isLoading: false,
		hasMore: false,
		next: vi.fn(),
		reset: vi.fn(),
	},
}));

vi.mock("@semoss/i18n", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@semoss/sdk/react", () => ({
	useIteratorPixel: () => mocks.list,
}));

vi.mock("@/components", () => ({
	WorkspaceCard: ({ workspace }: { workspace: { name: string } }) => (
		<div>{workspace.name}</div>
	),
}));

vi.mock("@/hooks", () => ({
	useChat: () => ({ chat: { deleteWorkspace: vi.fn() } }),
	useGlobalBreadcrumbs: () => undefined,
	useRoot: () => ({
		root: { theme: { images: { workspace: "", workspaceDark: "" } } },
	}),
}));

vi.mock("react-router", () => ({
	Link: ({
		to,
		children,
		...props
	}: { to: string; children?: React.ReactNode } & Record<
		string,
		unknown
	>) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

beforeEach(() => {
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: false,
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	}));
	mocks.list.data = [];
	mocks.list.isError = false;
	mocks.list.error = null;
	mocks.list.isLoading = false;
	mocks.list.reset.mockReset();
});

afterEach(() => {
	vi.unstubAllGlobals();
	cleanup();
});

describe("WorkspacePage states", () => {
	it("starts the page with one H3 and navigates to Create with a link", () => {
		mocks.list.data = [
			{
				project_id: "1",
				project_name: "First agent",
				user_permission: 1,
			},
		];
		render(<WorkspacePage />);
		expect(
			screen.getByRole("heading", { name: "workspace:catalog.title" }),
		).toHaveProperty("tagName", "H3");
		expect(
			screen
				.getByRole("link", { name: "workspace:actions.createAgent" })
				.getAttribute("href"),
		).toBe("/agent/new");
	});

	it("says there are no agents yet, and offers to create one, when the list is genuinely empty", () => {
		render(<WorkspacePage />);
		expect(
			screen.getByRole("heading", {
				name: "workspace:catalog.empty.title",
			}),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", {
				name: "workspace:catalog.clearFilters",
			}),
		).toBeNull();
		expect(
			screen.getAllByRole("link", {
				name: "workspace:actions.createAgent",
			}),
		).toHaveLength(2);
	});

	it("says nothing matches and clears the search when a search finds nothing", () => {
		render(<WorkspacePage />);
		const search = screen.getByLabelText("common:buttons.search");
		fireEvent.change(search, { target: { value: "zzz" } });
		expect(
			screen.getByRole("heading", {
				name: "workspace:catalog.filteredEmpty.title",
			}),
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole("button", {
				name: "workspace:catalog.clearFilters",
			}),
		);
		expect(search).toHaveValue("");
		expect(
			screen.getByRole("heading", {
				name: "workspace:catalog.empty.title",
			}),
		).toBeInTheDocument();
	});

	it("says nothing matches, and clears the filter, when a filter finds nothing", () => {
		render(<WorkspacePage />);
		const owner = screen.getByRole("button", {
			name: "workspace:catalog.filters.owner",
		});
		fireEvent.click(owner);
		expect(
			screen.getByRole("heading", {
				name: "workspace:catalog.filteredEmpty.title",
			}),
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole("button", {
				name: "workspace:catalog.clearFilters",
			}),
		);
		expect(
			screen.getByRole("heading", {
				name: "workspace:catalog.empty.title",
			}),
		).toBeInTheDocument();
	});

	it("shows an alert with Try Again, not an empty state, when the load failed", () => {
		mocks.list.isError = true;
		mocks.list.error = new Error("boom");
		render(<WorkspacePage />);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"workspace:catalog.error.title",
		);
		expect(
			screen.queryByRole("heading", {
				name: "workspace:catalog.empty.title",
			}),
		).toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: "common:buttons.retry" }),
		);
		expect(mocks.list.reset).toHaveBeenCalledOnce();
	});

	it("keeps the agents already loaded and shows the alert under them when a later page failed", () => {
		mocks.list.data = [
			{
				project_id: "1",
				project_name: "First agent",
				user_permission: 1,
			},
		];
		mocks.list.isError = true;
		render(<WorkspacePage />);
		expect(screen.getByText("First agent")).toBeInTheDocument();
		expect(screen.getByRole("alert")).toBeInTheDocument();
	});

	it("shows a spinner, not an empty state, while the first page loads", () => {
		mocks.list.isLoading = true;
		render(<WorkspacePage />);
		expect(
			screen.queryByRole("heading", {
				name: "workspace:catalog.empty.title",
			}),
		).toBeNull();
	});
});
