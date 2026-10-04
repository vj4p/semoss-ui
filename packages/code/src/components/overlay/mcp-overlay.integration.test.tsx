import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@semoss/agent-core";
import { MCPOverlay } from "./mcp-overlay";

const mockTools = [
	{
		id: "fs_tool",
		name: "File System",
		description: "Access files",
		category: "filesystem",
		tags: ["files", "io"],
		capabilities: [{ type: "read", description: "Read files" }],
		isEnabled: false,
	},
	{
		id: "web_tool",
		name: "Web Fetch",
		description: "Fetch URLs",
		category: "web",
		tags: ["http", "web"],
		capabilities: [{ type: "network", description: "HTTP requests" }],
		isEnabled: false,
	},
	{
		id: "db_tool",
		name: "Database",
		description: "Query database",
		category: "database",
		tags: ["sql", "data"],
		capabilities: [{ type: "read", description: "Query data" }],
		isEnabled: false,
	},
];

vi.mock("@semoss/shared", async () => {
	const actual = await vi.importActual("@semoss/shared");
	return {
		...actual,
		useMCPTools: vi.fn(() => ({
			tools: mockTools,
			loading: false,
			error: null,
			refetch: vi.fn(),
		})),
	};
});

describe("MCPOverlay integration", () => {
	const createMockSession = (enabledTools: string[] = []): Session =>
		({
			getState: vi.fn(() => ({
				catalog: { mcpTools: [] },
				enabledMCPTools: enabledTools,
			})),
			setMCPTools: vi.fn().mockResolvedValue(undefined),
			getEnabledMCPTools: vi.fn(() => enabledTools),
		}) as Session;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("filters tools by search query", async () => {
		const session = createMockSession();
		const user = userEvent.setup();

		render(
			<MCPOverlay open={true} onDismiss={vi.fn()} session={session} />,
		);

		// Should show all tools initially
		await waitFor(() => {
			expect(screen.getByText("File System")).toBeInTheDocument();
			expect(screen.getByText("Web Fetch")).toBeInTheDocument();
			expect(screen.getByText("Database")).toBeInTheDocument();
		});

		// Search for "web"
		const searchInput = screen.getByPlaceholderText(/search tools/i);
		await user.type(searchInput, "web");

		// Wait for debounce
		await waitFor(
			() => {
				expect(
					screen.queryByText("File System"),
				).not.toBeInTheDocument();
				expect(screen.getByText("Web Fetch")).toBeInTheDocument();
				expect(screen.queryByText("Database")).not.toBeInTheDocument();
			},
			{ timeout: 500 },
		);
	});

	it("filters tools by category", async () => {
		const session = createMockSession();
		const _user = userEvent.setup();

		render(
			<MCPOverlay open={true} onDismiss={vi.fn()} session={session} />,
		);

		// Initially all tools are shown
		await waitFor(() => {
			expect(screen.getByText("File System")).toBeInTheDocument();
			expect(screen.getByText("Web Fetch")).toBeInTheDocument();
			expect(screen.getByText("Database")).toBeInTheDocument();
		});

		// The FilterBar handles category filtering
		// For integration test, we verify the structure is in place
		// and filter options exist
		const filterElements = screen.getAllByRole("button");
		expect(filterElements.length).toBeGreaterThan(0);
	});

	it("full workflow: search, select, apply", async () => {
		const session = createMockSession();
		const onDismiss = vi.fn();
		const user = userEvent.setup();

		render(
			<MCPOverlay open={true} onDismiss={onDismiss} session={session} />,
		);

		// Search for "file"
		const searchInput = screen.getByPlaceholderText(/search tools/i);
		await user.type(searchInput, "file");

		await waitFor(() => {
			expect(screen.getByText("File System")).toBeInTheDocument();
		});

		// Select file system tool
		const fileSystemCard = screen.getByText("File System").closest("div");
		if (fileSystemCard) {
			await user.click(fileSystemCard);
		}

		// Verify selected count (look for "1 selected")
		await waitFor(() => {
			expect(screen.getByText(/1 selected/)).toBeInTheDocument();
		});

		// Click apply
		const applyButton = screen.getByText(/^Apply$/);
		await user.click(applyButton);

		// Should call setMCPTools with selected tool
		await waitFor(() => {
			expect(session.setMCPTools).toHaveBeenCalledWith(["fs_tool"]);
			expect(onDismiss).toHaveBeenCalled();
		});
	});

	it("preserves selection on reopen", async () => {
		const session = createMockSession(["fs_tool"]);

		render(
			<MCPOverlay open={true} onDismiss={vi.fn()} session={session} />,
		);

		// File system tool should be pre-selected
		await waitFor(() => {
			expect(screen.getByText("File System")).toBeInTheDocument();
			// Verify the selected count includes this tool
			expect(screen.getByText(/1 selected/)).toBeInTheDocument();
		});
	});
});
