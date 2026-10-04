import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SelectableCard } from "./selectable-card";

describe("SelectableCard", () => {
	const defaultProps = {
		id: "test-card",
		title: "Test Card",
		description: "This is a test card",
		selected: false,
		multiSelect: true,
		onSelect: vi.fn(),
	};

	it("renders title and description", () => {
		render(<SelectableCard {...defaultProps} />);

		expect(screen.getByText("Test Card")).toBeInTheDocument();
		expect(screen.getByText("This is a test card")).toBeInTheDocument();
	});

	it("shows checkbox when multiSelect=true", () => {
		render(<SelectableCard {...defaultProps} multiSelect={true} />);

		const checkbox = screen.getByTestId(
			"select-card-checkbox",
		) as HTMLInputElement;
		expect(checkbox).toBeInTheDocument();
		expect(checkbox.checked).toBe(false);
	});

	it("shows radio when multiSelect=false", () => {
		render(<SelectableCard {...defaultProps} multiSelect={false} />);

		const radio = screen.getByTestId(
			"select-card-radio",
		) as HTMLInputElement;
		expect(radio).toBeInTheDocument();
		expect(radio.checked).toBe(false);
	});

	it("shows selected state", () => {
		render(<SelectableCard {...defaultProps} selected={true} />);

		const checkbox = screen.getByTestId(
			"select-card-checkbox",
		) as HTMLInputElement;
		expect(checkbox.checked).toBe(true);
	});

	it("calls onSelect when clicked", async () => {
		const onSelect = vi.fn();
		const user = userEvent.setup();

		render(<SelectableCard {...defaultProps} onSelect={onSelect} />);

		await user.click(screen.getByText("Test Card"));

		expect(onSelect).toHaveBeenCalledWith("test-card", true);
	});

	it("toggles selection on click", async () => {
		const onSelect = vi.fn();
		const user = userEvent.setup();

		const { rerender } = render(
			<SelectableCard
				{...defaultProps}
				selected={false}
				onSelect={onSelect}
			/>,
		);

		await user.click(screen.getByText("Test Card"));
		expect(onSelect).toHaveBeenCalledWith("test-card", true);

		rerender(
			<SelectableCard
				{...defaultProps}
				selected={true}
				onSelect={onSelect}
			/>,
		);

		await user.click(screen.getByText("Test Card"));
		expect(onSelect).toHaveBeenCalledWith("test-card", false);
	});

	it("supports keyboard navigation with Space", async () => {
		const onSelect = vi.fn();
		const user = userEvent.setup();

		render(<SelectableCard {...defaultProps} onSelect={onSelect} />);

		const checkbox = screen.getByTestId("select-card-checkbox");
		checkbox.focus();
		await user.keyboard(" ");

		expect(onSelect).toHaveBeenCalledWith("test-card", true);
	});

	it("supports keyboard navigation with Enter", async () => {
		const onSelect = vi.fn();
		const user = userEvent.setup();

		render(<SelectableCard {...defaultProps} onSelect={onSelect} />);

		const checkbox = screen.getByTestId("select-card-checkbox");
		checkbox.focus();
		await user.keyboard("{Enter}");

		expect(onSelect).toHaveBeenCalledWith("test-card", true);
	});

	it("renders badges", () => {
		render(
			<SelectableCard
				{...defaultProps}
				badges={[
					{ label: "Badge 1", variant: "default" },
					{ label: "Badge 2", variant: "primary" },
				]}
			/>,
		);

		expect(screen.getByText("Badge 1")).toBeInTheDocument();
		expect(screen.getByText("Badge 2")).toBeInTheDocument();
	});

	it("renders custom metadata", () => {
		render(
			<SelectableCard
				{...defaultProps}
				metadata={<div>Custom metadata</div>}
			/>,
		);

		expect(screen.getByText("Custom metadata")).toBeInTheDocument();
	});

	it("is disabled when disabled=true", async () => {
		const onSelect = vi.fn();
		const user = userEvent.setup();

		render(
			<SelectableCard
				{...defaultProps}
				disabled={true}
				onSelect={onSelect}
			/>,
		);

		const checkbox = screen.getByTestId(
			"select-card-checkbox",
		) as HTMLInputElement;
		expect(checkbox.disabled).toBe(true);

		await user.click(screen.getByText("Test Card"));
		expect(onSelect).not.toHaveBeenCalled();
	});
});
