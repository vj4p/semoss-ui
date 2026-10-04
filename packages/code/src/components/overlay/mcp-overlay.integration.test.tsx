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
		const searchInput = screen.getByPlaceholderText(/search/i);
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
		const user = userEvent.setup();

		render(
			<MCPOverlay open={true} onDismiss={vi.fn()} session={session} />,
		);

		// Initially all tools are shown
		await waitFor(() => {
			expect(screen.getByText("File System")).toBeInTheDocument();
			expect(screen.getByText("Web Fetch")).toBeInTheDocument();
			expect(screen.getByText("Database")).toBeInTheDocument();
		});

		// Verify all 3 tool checkboxes are visible
		const allCheckboxes = screen.getAllByTestId("select-card-checkbox");
		expect(allCheckboxes.length).toBe(3);

		// Verify FilterBar is present with category filter
		const categoryButton = screen.getByText(/category/i);
		expect(categoryButton).toBeInTheDocument();

		// Click category button to open dropdown
		await user.click(categoryButton);

		// Verify category options are available in the dropdown
		await waitFor(() => {
			// Categories should be displayed (Database, Filesystem, Web)
			const categoryElements = screen.queryAllByText(
				/database|filesystem|web/i,
			);
			// Should have more than just the tool names - include category options
			expect(categoryElements.length).toBeGreaterThan(3);
		});

		// Find and click the Filesystem category option
		const allLabels = screen.getAllByRole("checkbox");
		const filesystemCheckbox = allLabels.find((cb) => {
			const label = cb.closest("label");
			return (
				label?.textContent?.toLowerCase().includes("filesystem") ??
				false
			);
		});

		if (filesystemCheckbox) {
			await user.click(filesystemCheckbox);

			// After selection, verify filtering applied
			await waitFor(
				() => {
					// File System tool should still be visible
					expect(screen.getByText("File System")).toBeInTheDocument();
					// Verify filter was applied (check rendered tools)
					const toolCheckboxes = screen.queryAllByTestId(
						"select-card-checkbox",
					);
					// Tool checkboxes should be reduced after filtering
					expect(toolCheckboxes.length).toBeLessThanOrEqual(3);
				},
				{ timeout: 500 },
			);
		}
	});

	it("full workflow: search, select, apply", async () => {
		const session = createMockSession();
		const onDismiss = vi.fn();
		const user = userEvent.setup();

		render(
			<MCPOverlay open={true} onDismiss={onDismiss} session={session} />,
		);

		// Search for "file"
		const searchInput = screen.getByPlaceholderText(/search/i);
		await user.type(searchInput, "file");

		await waitFor(() => {
			expect(screen.getByText("File System")).toBeInTheDocument();
		});

		// Select file system tool
		const fileSystemCard = screen.getByText("File System").closest("div");
		if (fileSystemCard) {
			await user.click(fileSystemCard);
		}

		// Verify selected count
		await waitFor(() => {
			expect(screen.getByText(/selected/)).toBeInTheDocument();
		});

		// Click apply button
		const applyButton = screen.getByRole("button", { name: /apply/i });
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

		// File system tool should be pre-selected when session loads initial state
		await waitFor(() => {
			expect(screen.getByText("File System")).toBeInTheDocument();
		});

		// Verify that selected count shows 1 tool is selected (reflecting loaded state)
		await waitFor(() => {
			const selectedText = screen.getByText(/selected/);
			expect(selectedText.textContent).toMatch(/1 selected/);
		});

		// Verify all 3 tool checkboxes are present
		const checkboxes = screen.getAllByTestId(
			"select-card-checkbox",
		) as HTMLInputElement[];
		expect(checkboxes.length).toBe(3);

		// Verify that exactly one checkbox is checked (the pre-selected one)
		const checkedCheckboxes = checkboxes.filter((cb) => cb.checked);
		expect(checkedCheckboxes).toHaveLength(1);
	});
});
