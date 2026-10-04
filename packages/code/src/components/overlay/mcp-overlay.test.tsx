import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCPOverlay } from "./mcp-overlay";

interface MockFilterBarProps {
	searchQuery: string;
	onSearchChange: (value: string) => void;
}

interface MockSelectableCardProps {
	title: string;
	selected: boolean;
	onSelect: (id: string, selected: boolean) => void;
	id: string;
}

vi.mock("@semoss/shared", () => ({
	useMCPTools: vi.fn(),
	FilterBar: ({ searchQuery, onSearchChange }: MockFilterBarProps) => (
		<input
			data-testid="search-input"
			placeholder="Search..."
			value={searchQuery}
			onChange={(e) => onSearchChange(e.target.value)}
		/>
	),
	SelectableCard: ({
		title,
		selected,
		onSelect,
		id,
	}: MockSelectableCardProps) => (
		// biome-ignore lint/a11y/noStaticElementInteractions: Test mock
		// biome-ignore lint/a11y/useKeyWithClickEvents: Test mock
		<div
			data-testid={`card-${title}`}
			onClick={() => onSelect(id, !selected)}
		>
			{title} {selected ? "✓" : ""}
		</div>
	),
}));

interface MockSession {
	getEnabledMCPTools: () => Promise<string[]>;
	setMCPTools: (toolIds: string[]) => Promise<void>;
}

describe("MCPOverlay", () => {
	const mockSession: MockSession = {
		getEnabledMCPTools: vi.fn(() => Promise.resolve([])),
		setMCPTools: vi.fn(() => Promise.resolve()),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows empty state when no tools", async () => {
		const { useMCPTools } = await import("@semoss/shared");
		vi.mocked(useMCPTools).mockReturnValue({
			tools: [],
			loading: false,
			error: null,
			refetch: vi.fn(),
		});

		render(
			<MCPOverlay
				open={true}
				onDismiss={vi.fn()}
				session={
					mockSession as unknown as import("@semoss/agent-core").Session
				}
			/>,
		);

		expect(screen.getByText(/no mcp tools/i)).toBeInTheDocument();
	});

	it("shows loading state", async () => {
		const { useMCPTools } = await import("@semoss/shared");
		vi.mocked(useMCPTools).mockReturnValue({
			tools: [],
			loading: true,
			error: null,
			refetch: vi.fn(),
		});

		render(
			<MCPOverlay
				open={true}
				onDismiss={vi.fn()}
				session={
					mockSession as unknown as import("@semoss/agent-core").Session
				}
			/>,
		);

		// Spinner is rendered
		expect(document.querySelector(".animate-spin")).toBeInTheDocument();
	});

	it("shows error state", async () => {
		const { useMCPTools } = await import("@semoss/shared");
		vi.mocked(useMCPTools).mockReturnValue({
			tools: [],
			loading: false,
			error: new Error("Failed to fetch"),
			refetch: vi.fn(),
		});

		render(
			<MCPOverlay
				open={true}
				onDismiss={vi.fn()}
				session={
					mockSession as unknown as import("@semoss/agent-core").Session
				}
			/>,
		);

		expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
		expect(
			screen.getByText(/unable to load mcp tools/i),
		).toBeInTheDocument();
	});

	it("renders tool cards", async () => {
		const { useMCPTools } = await import("@semoss/shared");
		const mockTools = [
			{
				id: "tool1",
				name: "File System",
				description: "Access files",
				category: "filesystem",
				tags: ["files"],
				capabilities: [],
				isEnabled: false,
			},
		];

		vi.mocked(useMCPTools).mockReturnValue({
			tools: mockTools,
			loading: false,
			error: null,
			refetch: vi.fn(),
		});

		render(
			<MCPOverlay
				open={true}
				onDismiss={vi.fn()}
				session={
					mockSession as unknown as import("@semoss/agent-core").Session
				}
			/>,
		);

		expect(screen.getByTestId("card-File System")).toBeInTheDocument();
	});

	it("calls setMCPTools on apply", async () => {
		const { useMCPTools } = await import("@semoss/shared");
		const mockSession = {
			getEnabledMCPTools: vi.fn(() => Promise.resolve([])),
			setMCPTools: vi.fn().mockResolvedValue(undefined),
		};

		const mockTools = [
			{
				id: "tool1",
				name: "File System",
				description: "Access files",
				category: "filesystem",
				tags: [],
				capabilities: [],
				isEnabled: false,
			},
		];

		vi.mocked(useMCPTools).mockReturnValue({
			tools: mockTools,
			loading: false,
			error: null,
			refetch: vi.fn(),
		});

		const user = userEvent.setup();
		const onDismiss = vi.fn();

		render(
			<MCPOverlay
				open={true}
				onDismiss={onDismiss}
				session={
					mockSession as unknown as import("@semoss/agent-core").Session
				}
			/>,
		);

		// Select tool
		await user.click(screen.getByTestId("card-File System"));

		// Click apply
		await user.click(screen.getByText(/apply/i));

		await waitFor(() => {
			expect(mockSession.setMCPTools).toHaveBeenCalledWith(["tool1"]);
			expect(onDismiss).toHaveBeenCalled();
		});
	});

	it("does not call setMCPTools on cancel", async () => {
		const { useMCPTools } = await import("@semoss/shared");
		const mockSession = {
			getEnabledMCPTools: vi.fn(() => Promise.resolve([])),
			setMCPTools: vi.fn().mockResolvedValue(undefined),
		};

		const mockTools = [
			{
				id: "tool1",
				name: "File System",
				description: "Access files",
				category: "filesystem",
				tags: [],
				capabilities: [],
				isEnabled: false,
			},
		];

		vi.mocked(useMCPTools).mockReturnValue({
			tools: mockTools,
			loading: false,
			error: null,
			refetch: vi.fn(),
		});

		const user = userEvent.setup();
		const onDismiss = vi.fn();

		render(
			<MCPOverlay
				open={true}
				onDismiss={onDismiss}
				session={
					mockSession as unknown as import("@semoss/agent-core").Session
				}
			/>,
		);

		// Select tool
		await user.click(screen.getByTestId("card-File System"));

		// Click cancel
		await user.click(screen.getByText(/cancel/i));

		await waitFor(() => {
			expect(mockSession.setMCPTools).not.toHaveBeenCalled();
			expect(onDismiss).toHaveBeenCalled();
		});
	});

	it("loads enabled tools from session on open", async () => {
		const { useMCPTools } = await import("@semoss/shared");
		const mockSession = {
			getEnabledMCPTools: vi.fn(() => Promise.resolve(["tool1"])),
			setMCPTools: vi.fn().mockResolvedValue(undefined),
		};

		const mockTools = [
			{
				id: "tool1",
				name: "File System",
				description: "Access files",
				category: "filesystem",
				tags: [],
				capabilities: [],
				isEnabled: false,
			},
		];

		vi.mocked(useMCPTools).mockReturnValue({
			tools: mockTools,
			loading: false,
			error: null,
			refetch: vi.fn(),
		});

		render(
			<MCPOverlay
				open={true}
				onDismiss={vi.fn()}
				session={
					mockSession as unknown as import("@semoss/agent-core").Session
				}
			/>,
		);

		await waitFor(() => {
			expect(mockSession.getEnabledMCPTools).toHaveBeenCalled();
		});

		// Check that the tool shows as selected
		const card = screen.getByTestId("card-File System");
		expect(card.textContent).toContain("✓");
	});
});
