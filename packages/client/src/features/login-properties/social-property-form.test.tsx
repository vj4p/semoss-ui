import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modifyLoginProperties } from "@/api";
import {
	type FieldProps,
	SECRET_SET,
} from "@/pages/settings/configuration-secrets";
import { SocialPropertyForm } from "./social-property-form";

vi.mock("@/api", () => ({ modifyLoginProperties: vi.fn() }));

const FIELDS: FieldProps[] = [
	{ label: "client_id", value: "abc" },
	{ label: "client_secret", value: SECRET_SET, wasSet: true },
];

/** Render the form and return what the page would hand it. */
const renderForm = (fields: FieldProps[] = FIELDS) => {
	const onFieldChange = vi.fn();
	const onReset = vi.fn();
	render(
		<SocialPropertyForm
			provider="google"
			fields={fields}
			onFieldChange={onFieldChange}
			onReset={onReset}
		/>,
	);
	return { onFieldChange, onReset };
};

describe("SocialPropertyForm", () => {
	beforeEach(() => {
		vi.mocked(modifyLoginProperties).mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it("labels every property and hides a secret that is already set", () => {
		renderForm();

		expect(screen.getByLabelText("client_id")).toHaveValue("abc");
		const secret = screen.getByLabelText("client_secret");
		expect(secret).toHaveAttribute("type", "password");
		expect(secret).toHaveValue("");
		expect(secret).toHaveAttribute(
			"placeholder",
			"Set. Type a new value to replace it.",
		);
	});

	it("reports an edit with its position, secret or not", () => {
		const { onFieldChange } = renderForm();

		fireEvent.change(screen.getByLabelText("client_id"), {
			target: { value: "xyz" },
		});
		fireEvent.change(screen.getByLabelText("client_secret"), {
			target: { value: "new-secret" },
		});

		expect(onFieldChange).toHaveBeenNthCalledWith(1, 0, "xyz");
		expect(onFieldChange).toHaveBeenNthCalledWith(2, 1, "new-secret");
	});

	it("saves the properties together and says so", async () => {
		vi.mocked(modifyLoginProperties).mockResolvedValue(true);
		renderForm();

		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(modifyLoginProperties).toHaveBeenCalledWith("google", {
				client_id: "abc",
				client_secret: SECRET_SET,
			}),
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("keeps a failed save on screen, with the edits, and lets the person retry", async () => {
		vi.mocked(modifyLoginProperties).mockRejectedValueOnce(
			new Error("Error: admin only"),
		);
		renderForm();

		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"admin only",
		);
		expect(screen.getByLabelText("client_id")).toHaveValue("abc");
		expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();

		vi.mocked(modifyLoginProperties).mockResolvedValueOnce(true);
		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
		);
	});

	it("blocks a second save while one is running", async () => {
		let finish: (saved: boolean) => void = () => {};
		vi.mocked(modifyLoginProperties).mockReturnValue(
			new Promise<boolean>((resolve) => {
				finish = resolve;
			}),
		);
		renderForm();

		fireEvent.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled(),
		);
		fireEvent.submit(
			screen
				.getByRole("button", { name: /Save/ })
				.closest("form") as HTMLFormElement,
		);

		expect(modifyLoginProperties).toHaveBeenCalledTimes(1);
		finish(true);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Save" })).toBeEnabled(),
		);
	});

	it("hands Reset to the page", () => {
		const { onReset } = renderForm();

		fireEvent.click(screen.getByRole("button", { name: "Reset" }));

		expect(onReset).toHaveBeenCalledTimes(1);
	});
});
