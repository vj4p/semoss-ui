import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DeleteThemeDialog,
	type DeleteThemeDialogProps,
} from "./delete-theme-dialog";

/** Render the dialog open, with `overrides` on top of an idle, inactive theme */
const renderDialog = (overrides: Partial<DeleteThemeDialogProps> = {}) => {
	const onConfirm = vi.fn();
	const onCancel = vi.fn();
	render(
		<DeleteThemeDialog
			open
			themeName="Ocean"
			isActive={false}
			isDeleting={false}
			onConfirm={onConfirm}
			onCancel={onCancel}
			{...overrides}
		/>,
	);
	return { onConfirm, onCancel };
};

describe("DeleteThemeDialog", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe() {}
				unobserve() {}
				disconnect() {}
			},
		);
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it("names the theme and does nothing until confirmed", () => {
		const { onConfirm } = renderDialog();

		expect(screen.getByText(/Deleting Ocean removes/)).toBeInTheDocument();
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it("warns that deleting the active theme restores the default look", () => {
		renderDialog({ isActive: true });

		expect(
			screen.getByText(/switches the instance back to the default look/),
		).toBeInTheDocument();
	});

	it("confirms and cancels through its buttons", () => {
		const { onConfirm, onCancel } = renderDialog();

		fireEvent.click(screen.getByRole("button", { name: "Delete theme" }));
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it("cannot be dismissed while the delete runs", () => {
		const { onCancel } = renderDialog({ isDeleting: true });

		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

		expect(onCancel).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: /Deleting/ })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
	});
});
