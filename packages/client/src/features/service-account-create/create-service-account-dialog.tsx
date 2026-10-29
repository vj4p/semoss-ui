import { Download } from "lucide-react";
import { useState } from "react";
import {
	Alert,
	AlertDescription,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Form,
	FormInput,
	Spinner,
	toast,
	useForm,
	z,
	zodResolver,
} from "@semoss/ui/next";
import { downloadBlob } from "@semoss/utility/browser";
import { getErrorMessage } from "@semoss/utility/error";
import { sanitizeFileNameStem } from "@semoss/utility/file";
import { createAPIUser } from "@/api";
import { SdkBlock } from "@/components/shared/sdk-block";

const schema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Service account name is required")
		.max(255, "Use 255 characters or fewer"),
});

type CreateServiceAccountValues = z.infer<typeof schema>;

/** What the server returns for a new account: the credentials, or an error */
type CreatedCredentials = Record<string, string>;

/** The server's refusal when the API User login provider is switched off */
const LOGIN_OFF_MESSAGE = "not allowed for login";

/**
 * Turns a failed create into a message the person can act on
 * @param error - what the request rejected with
 * @returns the message to show in the dialog
 */
const describeCreateError = (error: unknown): string => {
	const message = getErrorMessage(error, "Unable to create service account");
	return message.includes(LOGIN_OFF_MESSAGE)
		? "Service accounts are turned off on this server. An admin can turn on the API User login under Settings, Configuration."
		: message;
};

export interface CreateServiceAccountDialogProps {
	/** Whether the dialog is open */
	open: boolean;
	/** Called once the account exists, so the list can reload behind the dialog */
	onCreated: () => void;
	/** Called when the dialog closes */
	onClose: () => void;
}

/**
 * Creates a service account and shows its credentials once. The credentials
 * cannot be read again, so after creation the dialog stays open until the
 * person chooses Done: Escape, an outside click and the close button are off.
 * Mount it only while it is needed so each use starts empty.
 */
export const CreateServiceAccountDialog = ({
	open,
	onCreated,
	onClose,
}: CreateServiceAccountDialogProps) => {
	const [credentials, setCredentials] = useState<CreatedCredentials | null>(
		null,
	);
	const form = useForm<CreateServiceAccountValues>({
		resolver: zodResolver(schema),
		defaultValues: { name: "" },
	});
	const { errors, isSubmitting } = form.formState;
	const isCreated = credentials !== null;
	const credentialEntries = Object.entries(credentials ?? {}).filter(
		([key]) => key !== "errorMessage",
	);

	const handleSubmit = async (
		values: CreateServiceAccountValues,
	): Promise<void> => {
		let created: CreatedCredentials;
		try {
			const response = await createAPIUser(values.name);
			if (!response) {
				throw new Error("Unable to create service account");
			}
			if (response.errorMessage) {
				throw new Error(response.errorMessage);
			}
			created = response;
		} catch (e: unknown) {
			form.setError("root.server", {
				type: "server",
				message: describeCreateError(e),
			});
			return;
		}
		setCredentials(created);
		toast.success("Service account created");
		onCreated();
	};

	const handleDownload = (): void => {
		if (!credentials) {
			return;
		}
		const slug =
			sanitizeFileNameStem(form.getValues("name")) || "service-account";
		downloadBlob(
			new Blob([JSON.stringify(credentials, null, 2)], {
				type: "application/json",
			}),
			`${slug}-credentials.json`,
		);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen && !isSubmitting && !isCreated) {
					onClose();
				}
			}}
		>
			<DialogContent
				className="max-w-2xl"
				showCloseButton={!isSubmitting && !isCreated}
				onEscapeKeyDown={(event) => {
					if (isSubmitting || isCreated) {
						event.preventDefault();
					}
				}}
				onInteractOutside={(event) => {
					if (isSubmitting || isCreated) {
						event.preventDefault();
					}
				}}
			>
				<DialogHeader>
					<DialogTitle className="font-medium text-base leading-6">
						Create Service Account
					</DialogTitle>
					<DialogDescription>
						Create a service account for machine-based access.
					</DialogDescription>
				</DialogHeader>
				<Form
					form={form}
					onSubmit={handleSubmit}
					noValidate
					aria-busy={isSubmitting}
					className="flex flex-col gap-4"
				>
					<FormInput
						name="name"
						label="Service Account Name"
						placeholder="Enter service account name"
						required
						autoComplete="off"
						disabled={isSubmitting || isCreated}
					/>
					{isCreated ? (
						<Alert>
							<AlertDescription>
								Copy these credentials now. They are shown once
								and cannot be read again.
							</AlertDescription>
						</Alert>
					) : (
						<p className="text-muted-foreground text-sm">
							One-time credentials are shown only once after
							creation. Copy and store them now.
						</p>
					)}
					{errors.root?.server?.message ? (
						<Alert variant="destructive">
							<AlertDescription>
								{errors.root.server.message}
							</AlertDescription>
						</Alert>
					) : null}
					{isCreated ? (
						<div className="flex flex-col gap-3">
							{credentialEntries.length > 0 ? (
								credentialEntries.map(([key, value]) => (
									<SdkBlock
										key={key}
										label={key.toLowerCase()}
										code={value}
										testId={`serviceAccount-${key}-copy-btn`}
									/>
								))
							) : (
								<p className="text-sm">
									Service account created successfully.
								</p>
							)}
						</div>
					) : null}
					<DialogFooter>
						{isCreated ? (
							<>
								<Button
									type="button"
									variant="outline"
									onClick={handleDownload}
								>
									<Download className="size-4" aria-hidden />
									Download JSON
								</Button>
								<Button type="button" onClick={onClose}>
									Done
								</Button>
							</>
						) : (
							<>
								<Button
									type="button"
									variant="outline"
									disabled={isSubmitting}
									onClick={onClose}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? (
										<Spinner className="size-4" />
									) : null}
									{isSubmitting ? "Creating..." : "Create"}
								</Button>
							</>
						)}
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
