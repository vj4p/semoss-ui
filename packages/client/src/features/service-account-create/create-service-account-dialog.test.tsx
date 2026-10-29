import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAPIUser } from "@/api";
import { CreateServiceAccountDialog } from "./create-service-account-dialog";

vi.mock("@/api", () => ({ createAPIUser: vi.fn() }));

/** Open the dialog, returning its callbacks */
const renderDialog = () => {
	const onCreated = vi.fn();
	const onClose = vi.fn();
	render(
		<CreateServiceAccountDialog
			open
			onCreated={onCreated}
			onClose={onClose}
		/>,
	);
	return { onCreated, onClose };
};

/** Fill the name and submit */
const submitName = (name: string) => {
	fireEvent.change(screen.getByLabelText(/Service Account Name/), {
		target: { value: name },
	});
	fireEvent.click(screen.getByRole("button", { name: "Create" }));
};

describe("CreateServiceAccountDialog", () => {
	beforeEach(() => {
		vi.mocked(createAPIUser).mockReset();
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

	it("names its input with a label", () => {
		renderDialog();

		expect(
			screen.getByRole("textbox", { name: /Service Account Name/ }),
		).toBeInTheDocument();
	});

	it("asks for a name instead of creating an unnamed account", async () => {
		const { onCreated } = renderDialog();

		fireEvent.click(screen.getByRole("button", { name: "Create" }));

		expect(
			await screen.findByText("Service account name is required"),
		).toBeInTheDocument();
		expect(createAPIUser).not.toHaveBeenCalled();
		expect(onCreated).not.toHaveBeenCalled();
	});

	it("keeps the name and shows the error in the dialog when the server refuses", async () => {
		vi.mocked(createAPIUser).mockResolvedValue({
			errorMessage: "That name is already taken",
		});
		const { onCreated, onClose } = renderDialog();

		submitName("robot");

		expect(
			await screen.findByText("That name is already taken"),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/Service Account Name/)).toHaveValue(
			"robot",
		);
		expect(onCreated).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
		// the person can fix the name and try again
		expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
	});

	it("says how to turn service accounts on when the server has them off", async () => {
		vi.mocked(createAPIUser).mockRejectedValue(
			new Error("S: API User is not allowed for login"),
		);
		renderDialog();

		submitName("robot");

		expect(
			await screen.findByText(/Service accounts are turned off/),
		).toBeInTheDocument();
		expect(screen.queryByText(/S: API User/)).not.toBeInTheDocument();
	});

	it("shows the credentials once and stays open until Done", async () => {
		vi.mocked(createAPIUser).mockResolvedValue({
			CLIENT_ID: "abc",
			CLIENT_SECRET: "s3cret",
		});
		const { onCreated, onClose } = renderDialog();

		submitName("robot");

		expect(await screen.findByText("s3cret")).toBeInTheDocument();
		expect(createAPIUser).toHaveBeenCalledWith("robot");
		expect(onCreated).toHaveBeenCalledTimes(1);

		// Escape would discard credentials that cannot be read again
		fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
		await waitFor(() => expect(screen.getByText("s3cret")).toBeVisible());
		expect(onClose).not.toHaveBeenCalled();
		expect(
			screen.queryByRole("button", { name: "Close" }),
		).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Done" }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("closes on Cancel before anything is created", () => {
		const { onClose } = renderDialog();

		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(createAPIUser).not.toHaveBeenCalled();
	});
});
