import { useId, useState } from "react";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Field,
	FieldError,
	FieldLabel,
	Input,
	Spinner,
} from "@semoss/ui/next";
import {
	isValidResetEmail,
	type PasswordResetType,
	requestPasswordReset,
} from "./forgot-password";

export interface ForgotPasswordDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The login type the account uses. */
	type: PasswordResetType;
	/** The email's subject line. */
	subject: string;
}

/** Collects an email and asks the backend to send a reset link. */
export function ForgotPasswordDialog({
	open,
	onOpenChange,
	type,
	subject,
}: ForgotPasswordDialogProps) {
	const emailId = useId();
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setEmail("");
			setError("");
			setSuccess("");
			setSubmitting(false);
		}
		onOpenChange(next);
	};

	const submit = async () => {
		const value = email.trim();
		if (!value) {
			setError("Email is required.");
			return;
		}
		if (!isValidResetEmail(value)) {
			setError("Please enter a valid email address.");
			return;
		}

		setSubmitting(true);
		setError("");
		setSuccess("");
		try {
			const response = await requestPasswordReset(value, type, subject);
			setSuccess(response.message || `Email has been sent to: ${value}`);
		} catch (e) {
			setError(
				e instanceof Error && e.message
					? e.message
					: "Unable to submit password reset request.",
			);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<form
					noValidate
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						void submit();
					}}
				>
					<DialogHeader>
						<DialogTitle>Forgot your password?</DialogTitle>
						<DialogDescription>
							Enter your email and we will send you a link to
							reset it.
						</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor={emailId}>Email</FieldLabel>
						<Input
							id={emailId}
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={submitting}
							autoComplete="email"
						/>
						{error && <FieldError>{error}</FieldError>}
					</Field>
					{success && (
						<output className="block text-sm text-success">
							{success}
						</output>
					)}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => handleOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={submitting}>
							{submitting && <Spinner className="size-4" />}
							Send reset link
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
