import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
let providers: { provider: string; name: string; isOauth: boolean }[] = [];

vi.mock("@semoss/sdk/react", () => ({
	useInsight: () => ({
		system: { config: { availableProviders: providers } },
		actions: { login: vi.fn(), requestOTP: vi.fn() },
	}),
	post: (...args: unknown[]) => post(...args),
	Env: { MODULE: "/Monolith", CSRF: false },
	CSRF: { isEnabled: false, token: "" },
}));

import { LoginForm } from "./login-form";

const native = { provider: "native", name: "Native", isOauth: false };
const microsoft = { provider: "microsoft", name: "Microsoft", isOauth: true };

beforeEach(() => {
	post.mockReset();
	providers = [native];
});

afterEach(cleanup);

describe("password reveal", () => {
	it("hides the password until asked", () => {
		render(<LoginForm />);
		const input = screen.getByPlaceholderText(
			"Password",
		) as HTMLInputElement;
		expect(input.type).toBe("password");

		fireEvent.click(screen.getByRole("button", { name: "Show password" }));
		expect(input.type).toBe("text");

		const hide = screen.getByRole("button", { name: "Hide password" });
		expect(hide.getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(hide);
		expect(input.type).toBe("password");
	});
});

describe("forgot password", () => {
	it("is offered when a credential provider is on", () => {
		render(<LoginForm />);
		expect(
			screen.getByRole("button", { name: "Forgot password?" }),
		).toBeTruthy();
	});

	it("is not offered when only a single sign-on provider is on", () => {
		providers = [microsoft];
		render(<LoginForm />);
		expect(
			screen.queryByRole("button", { name: "Forgot password?" }),
		).toBeNull();
	});

	const openDialog = () => {
		render(<LoginForm />);
		fireEvent.click(
			screen.getByRole("button", { name: "Forgot password?" }),
		);
	};

	it("asks for an email", () => {
		openDialog();
		expect(screen.getByText("Forgot your password?")).toBeTruthy();
		fireEvent.click(
			screen.getByRole("button", { name: "Send reset link" }),
		);
		expect(screen.getByText("Email is required.")).toBeTruthy();
		expect(post).not.toHaveBeenCalled();
	});

	it("rejects an invalid email", () => {
		openDialog();
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "nope" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Send reset link" }),
		);
		expect(
			screen.getByText("Please enter a valid email address."),
		).toBeTruthy();
		expect(post).not.toHaveBeenCalled();
	});

	it("posts the request and shows the answer", async () => {
		post.mockResolvedValue({
			data: { success: true, message: "Reset link sent" },
		});
		openDialog();
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.co" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Send reset link" }),
		);

		await waitFor(() =>
			expect(screen.getByText("Reset link sent")).toBeTruthy(),
		);
		expect(post).toHaveBeenCalledWith(
			"/Monolith/api/auth/user/setupResetPassword",
			{
				email: "a@b.co",
				type: "NATIVE",
				subject: "SEMOSS Reset Password Request",
			},
		);
	});

	it("does not also submit the sign-in form", async () => {
		post.mockResolvedValue({
			data: { success: true, message: "Reset link sent" },
		});
		openDialog();
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.co" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Send reset link" }),
		);
		await waitFor(() =>
			expect(screen.getByText("Reset link sent")).toBeTruthy(),
		);
		expect(
			screen.queryByText("Username and Password is Required"),
		).toBeNull();
	});

	it("shows why a request failed", async () => {
		post.mockRejectedValue({
			response: { data: { errorMessage: "No such user" } },
		});
		openDialog();
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.co" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: "Send reset link" }),
		);
		await waitFor(() =>
			expect(screen.getByText("No such user")).toBeTruthy(),
		);
	});
});
