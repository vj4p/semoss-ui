import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FilterBar } from "./filter-bar";

describe("FilterBar", () => {
	const mockCategories = [
		{ id: "cat1", label: "Category 1" },
		{ id: "cat2", label: "Category 2" },
	];

	const mockSortOptions = [
		{ id: "name-asc", label: "Name (A-Z)" },
		{ id: "name-desc", label: "Name (Z-A)" },
	];

	const defaultProps = {
		searchQuery: "",
		onSearchChange: vi.fn(),
		categories: mockCategories,
		selectedCategories: [],
		onCategoryChange: vi.fn(),
		sortOptions: mockSortOptions,
		sortBy: "name-asc",
		onSortChange: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders search input", () => {
		render(<FilterBar {...defaultProps} />);

		expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
	});

	it("debounces search input", async () => {
		const onSearchChange = vi.fn();
		const user = userEvent.setup();

		render(<FilterBar {...defaultProps} onSearchChange={onSearchChange} />);

		const input = screen.getByPlaceholderText(/search/i);
		await user.type(input, "test");

		// Should not call immediately
		expect(onSearchChange).not.toHaveBeenCalled();

		// Should call after debounce delay
		await waitFor(
			() => {
				expect(onSearchChange).toHaveBeenCalledWith("test");
			},
			{ timeout: 500 },
		);
	});

	it("renders category dropdown", () => {
		render(<FilterBar {...defaultProps} />);

		expect(screen.getByText(/category/i)).toBeInTheDocument();
	});

	it("renders sort dropdown", () => {
		render(<FilterBar {...defaultProps} />);

		expect(screen.getByText(/name \(a-z\)/i)).toBeInTheDocument();
	});

	it("renders show enabled toggle when provided", () => {
		render(
			<FilterBar
				{...defaultProps}
				showOnlyEnabled={false}
				onShowOnlyEnabledChange={vi.fn()}
			/>,
		);

		expect(screen.getByText(/enabled/i)).toBeInTheDocument();
	});

	it("does not render show enabled toggle when not provided", () => {
		render(<FilterBar {...defaultProps} />);

		expect(
			screen.queryByText(/show only enabled/i),
		).not.toBeInTheDocument();
	});

	it("renders tag filter when provided", () => {
		const tags = [
			{ id: "tag1", label: "Tag 1" },
			{ id: "tag2", label: "Tag 2" },
		];

		render(
			<FilterBar
				{...defaultProps}
				tags={tags}
				selectedTags={[]}
				onTagChange={vi.fn()}
			/>,
		);

		expect(screen.getByText(/tags/i)).toBeInTheDocument();
	});

	it("calls onCategoryChange when category selected", async () => {
		const onCategoryChange = vi.fn();
		const user = userEvent.setup();

		render(
			<FilterBar {...defaultProps} onCategoryChange={onCategoryChange} />,
		);

		// This test assumes Select component behavior
		// Actual implementation may differ based on Select component API
		const categoryButton = screen.getByText(/category/i);
		await user.click(categoryButton);

		// Select first category
		const option = await screen.findByText("Category 1");
		await user.click(option);

		expect(onCategoryChange).toHaveBeenCalled();
	});

	it("shows selected category count badge", () => {
		render(
			<FilterBar
				{...defaultProps}
				selectedCategories={["cat1", "cat2"]}
			/>,
		);

		// Should show count badge or selected state
		expect(screen.getByText(/2/)).toBeInTheDocument();
	});
});
