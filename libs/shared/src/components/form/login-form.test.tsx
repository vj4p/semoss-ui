import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const mocks = vi.hoisted(() => ({
	login: vi.fn<(credentials: unknown) => Promise<boolean>>(),
	requestOTP: vi.fn<(username: string, pin: string) => Promise<boolean>>(),
	providers: null as
		| { provider: string; name: string; label: string; isOauth: boolean }[]
		| null,
	post: vi.fn(),
	toastError: vi.fn(),
	toastSuccess: vi.fn(),
}));

// the form reads the session's actions and the config's providers; the
// forgot password dialog posts the reset request through the SDK's `post`
vi.mock("@semoss/sdk/react", () => ({
	post: (...args: unknown[]) => mocks.post(...args),
	Env: { MODULE: "/Monolith", CSRF: false },
	CSRF: { isEnabled: false, token: "" },
	useSession: <T,>(
		selector: (state: {
			login: typeof mocks.login;
			requestOTP: typeof mocks.requestOTP;
		}) => T,
	): T => selector({ login: mocks.login, requestOTP: mocks.requestOTP }),
	useConfig: <T,>(
		selector: (state: {
			config: { availableProviders: typeof mocks.providers } | null;
		}) => T,
	): T =>
		selector({
			config: mocks.providers
				? { availableProviders: mocks.providers }
				: null,
		}),
}));

vi.mock("@semoss/ui/next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@semoss/ui/next")>();
	return {
		...actual,
		toast: {
			...actual.toast,
			error: mocks.toastError,
			success: mocks.toastSuccess,
		},
	};
});

// the logos load lazily and are not under test
vi.mock("../login-provider-icon", () => ({ LoginProviderIcon: () => null }));

/** Type into the username and password fields, then press Login. */
const submitCredentials = (username: string, password: string) => {
	fireEvent.change(screen.getByTestId("loginForm-input-username"), {
		target: { value: username },
	});
	fireEvent.change(screen.getByTestId("loginForm-input-password"), {
		target: { value: password },
	});
	fireEvent.click(screen.getByTestId("loginForm-button-login"));
};

describe("LoginForm", () => {
	beforeEach(() => {
		mocks.login.mockReset();
		mocks.requestOTP.mockReset();
		mocks.post.mockReset();
		mocks.providers = [
			{ provider: "ms", name: "Microsoft", label: "MS", isOauth: true },
			{ provider: "ldap", name: "", label: "LDAP", isOauth: false },
			{
				provider: "native",
				name: "Company Login",
				label: "NATIVE",
				isOauth: false,
			},
		];
	});

	afterEach(() => {
		cleanup();
		mocks.toastError.mockReset();
		mocks.toastSuccess.mockReset();
	});

	it("offers the config's providers in order with their display names", () => {
		render(<LoginForm />);

		const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
		expect(tabs).toEqual(["Company Login", "Active Directory"]);
		expect(screen.getByRole("button", { name: "Microsoft" })).toBeTruthy();
	});

	it("renders no providers while the config is unread", () => {
		mocks.providers = null;
		render(<LoginForm />);

		expect(screen.queryByTestId("loginForm-button-login")).toBeNull();
		expect(screen.queryAllByRole("tab")).toHaveLength(0);
	});

	it("signs in through the session with the selected provider", async () => {
		mocks.login.mockResolvedValue(true);
		render(<LoginForm />);

		submitCredentials("ada", "secret");

		await waitFor(() =>
			expect(mocks.login).toHaveBeenCalledWith({
				type: "native",
				username: "ada",
				password: "secret",
			}),
		);
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("shows the fallback error when the session stays signed out", async () => {
		mocks.login.mockResolvedValue(false);
		render(<LoginForm />);

		submitCredentials("ada", "wrong");

		expect(
			(await screen.findByRole("alert")).textContent?.includes(
				"Unable to login. Check your credentials and try again.",
			),
		).toBe(true);
	});

	it("shows the backend's message when the sign in is refused", async () => {
		mocks.login.mockRejectedValue(new Error("Invalid password"));
		render(<LoginForm />);

		submitCredentials("ada", "wrong");

		expect(
			(await screen.findByRole("alert")).textContent?.includes(
				"Invalid password",
			),
		).toBe(true);
	});

	it("asks for the otp, then signs in with it", async () => {
		mocks.providers = [
			{ provider: "linotp", name: "", label: "LINOTP", isOauth: false },
		];
		mocks.requestOTP.mockResolvedValue(true);
		mocks.login.mockResolvedValue(true);
		render(<LoginForm />);

		submitCredentials("ada", "1234");

		const otp = await screen.findByTestId("loginForm-input-otp");
		expect(mocks.requestOTP).toHaveBeenCalledWith("ada", "1234");
		fireEvent.change(otp, { target: { value: "987654" } });
		fireEvent.click(screen.getByTestId("loginForm-button-login"));

		await waitFor(() =>
			expect(mocks.login).toHaveBeenCalledWith({
				type: "linotp",
				otp: "987654",
			}),
		);
	});

	it("only reports an OAuth sign in once the session is signed in", async () => {
		mocks.login.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		render(<LoginForm />);
		const microsoft = screen.getByRole("button", { name: "Microsoft" });

		fireEvent.click(microsoft);
		await waitFor(() =>
			expect(mocks.login).toHaveBeenCalledWith({
				type: "oauth",
				provider: "ms",
			}),
		);
		await waitFor(() =>
			expect(
				screen
					.getByRole("button", { name: "Microsoft" })
					.hasAttribute("disabled"),
			).toBe(false),
		);
		expect(mocks.toastSuccess).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Microsoft" }));
		await waitFor(() =>
			expect(mocks.toastSuccess).toHaveBeenCalledWith(
				"Successfully logged in",
			),
		);
	});

	it("shows a refused OAuth sign in", async () => {
		mocks.login.mockRejectedValue(new Error("Popup blocked"));
		render(<LoginForm />);

		fireEvent.click(screen.getByRole("button", { name: "Microsoft" }));

		await waitFor(() =>
			expect(mocks.toastError).toHaveBeenCalledWith("Popup blocked"),
		);
		expect(mocks.toastSuccess).not.toHaveBeenCalled();
	});
});

const native = {
	provider: "native",
	name: "Native",
	label: "NATIVE",
	isOauth: false,
};
const microsoft = {
	provider: "microsoft",
	name: "Microsoft",
	label: "MS",
	isOauth: true,
};

describe("password reveal", () => {
	beforeEach(() => {
		mocks.providers = [native];
	});

	afterEach(cleanup);

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
	beforeEach(() => {
		mocks.post.mockReset();
		mocks.providers = [native];
	});

	afterEach(cleanup);

	it("is offered when a credential provider is on", () => {
		render(<LoginForm />);
		expect(
			screen.getByRole("button", { name: "Forgot password?" }),
		).toBeTruthy();
	});

	it("is not offered when only a single sign-on provider is on", () => {
		mocks.providers = [microsoft];
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
		expect(mocks.post).not.toHaveBeenCalled();
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
		expect(mocks.post).not.toHaveBeenCalled();
	});

	it("posts the request and shows the answer", async () => {
		mocks.post.mockResolvedValue({
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
		expect(mocks.post).toHaveBeenCalledWith(
			"/Monolith/api/auth/user/setupResetPassword",
			{
				email: "a@b.co",
				type: "NATIVE",
				subject: "SEMOSS Reset Password Request",
			},
		);
	});

	it("does not also submit the sign-in form", async () => {
		mocks.post.mockResolvedValue({
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
		mocks.post.mockRejectedValue({
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
