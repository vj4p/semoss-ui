import { Env, post } from "@semoss/sdk/react";

/** The login types the backend can send a reset link for. */
export type PasswordResetType = "NATIVE" | "LDAP" | "LINOTP";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whether a value looks like an email address; the backend does the real check. */
export const isValidResetEmail = (value: string): boolean =>
	EMAIL_PATTERN.test(value);

/**
 * Asks the backend to email a password reset link. The SDK's `post` adds the
 * CSRF token when the deployment requires one.
 *
 * @name requestPasswordReset
 * @param email - Where to send the link.
 * @param type - The login type the account uses.
 * @param subject - The email's subject line.
 * @return The backend's answer; throws an Error with its message on failure.
 */
export const requestPasswordReset = async (
	email: string,
	type: PasswordResetType,
	subject: string,
): Promise<{ success: boolean; message?: string }> => {
	const response = await post<{ success: boolean; message?: string }>(
		`${Env.MODULE}/api/auth/user/setupResetPassword`,
		{ email, type, subject },
	).catch((error) => {
		throw Error(
			error?.response?.data?.errorMessage ||
				error?.response?.data?.ERROR_MESSAGE ||
				error?.response?.data?.message ||
				error?.message ||
				"Failed to request a password reset.",
		);
	});

	if (!response) {
		throw Error("No response while requesting password reset.");
	}

	return response.data;
};
