import { useEffect } from "react";
import type { Project } from "@semoss/shared";
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
	FieldGroup,
	Form,
	FormInput,
	FormSwitch,
	FormTextarea,
	Spinner,
	toast,
	useForm,
	z,
	zodResolver,
} from "@semoss/ui/next";
import { getErrorMessage } from "@semoss/utility/error";
import { buildSetProjectMetadataPixel } from "@/api/catalog-meta";
import {
	buildCloneSkillPixel,
	buildCreateAppFromTemplatePixel,
} from "@/api/project-clone";
import { useSession } from "@/hooks";

const schema = z.object({
	name: z.string().trim().min(1, "Name is required"),
	description: z.string().default(""),
	isGlobal: z.boolean().default(false),
});

type FormInputValues = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export interface CloneProjectDialogProps {
	/** Track if the dialog is open */
	open: boolean;
	/** Full project object to clone (picks project_id and project_type) */
	project: Pick<Project, "project_id" | "project_type">;
	/** Callback alias for backward compatibility */
	onClose: (projectId?: string) => void;
}

export const CloneProjectDialog = (props: CloneProjectDialogProps) => {
	const { open, project, onClose } = props;
	const runPixel = useSession((state) => state.runPixel);

	const label =
		project.project_type === "SKILL"
			? "Skill"
			: project.project_type === "WORKSPACE"
				? "Agent"
				: project.project_type === "NOTEBOOK"
					? "Notebook"
					: "App";

	const form = useForm<FormInputValues, unknown, FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			name: "",
			description: "",
			isGlobal: false,
		},
	});

	useEffect(() => {
		if (open) {
			form.reset({
				name: "",
				description: "",
				isGlobal: false,
			});
		}
	}, [open, form.reset]);

	const handleSubmit = async (values: FormValues): Promise<void> => {
		if (!project.project_id) return;

		let clonedProjectId: string | undefined;
		// the clone exists once the first call returns; a description that then fails
		// to save is reported on its own, so a retry does not make a second clone
		let descriptionFailure: string | undefined;
		try {
			if (project.project_type === "SKILL") {
				const { errors, pixelReturn } = await runPixel(
					buildCloneSkillPixel(project.project_id, values.name),
				);

				if (errors.length > 0) {
					throw new Error(errors.join(""));
				}

				clonedProjectId = String(
					(pixelReturn[0].output as { project_id?: string })
						?.project_id || "",
				);
			} else {
				const { errors, pixelReturn } = await runPixel(
					buildCreateAppFromTemplatePixel(
						values.name,
						project.project_id,
						values.isGlobal,
					),
				);

				if (errors.length > 0) {
					throw new Error(errors.join(""));
				}

				clonedProjectId = String(
					(pixelReturn[0]?.output as { project_id?: string })
						?.project_id || "",
				);

				const trimmedDescription = values.description.trim();
				if (trimmedDescription && clonedProjectId) {
					try {
						const metaResponse = await runPixel(
							buildSetProjectMetadataPixel(clonedProjectId, {
								description: trimmedDescription,
							}),
						);

						if (metaResponse.errors.length > 0) {
							throw new Error(metaResponse.errors.join(""));
						}
					} catch (error: unknown) {
						descriptionFailure = getErrorMessage(
							error,
							"The description could not be saved.",
						);
					}
				}
			}
		} catch (error: unknown) {
			// shown in the dialog, with the server's reason: "try again" is no use when
			// the project is not a template at all, and a toast is gone before it is read
			form.setError("root.server", {
				type: "server",
				message: getErrorMessage(
					error,
					`There was an error cloning your ${label.toLowerCase()}.`,
				),
			});
			return;
		}

		if (descriptionFailure) {
			toast.warning(
				`${label} cloned, but its description was not saved: ${descriptionFailure}`,
			);
		} else {
			toast.success(`${label} cloned successfully`);
		}
		onClose(clonedProjectId);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				// closing does not stop the request, so stay until it has answered
				if (!nextOpen && !form.formState.isSubmitting) {
					onClose();
				}
			}}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="font-medium text-base leading-6">
						Clone {label}
					</DialogTitle>
					<DialogDescription>
						Create a new {label.toLowerCase()} from this template.
					</DialogDescription>
				</DialogHeader>

				<Form
					form={form}
					onSubmit={handleSubmit}
					noValidate
					aria-busy={form.formState.isSubmitting}
				>
					<FieldGroup className="py-2">
						<FormInput
							name="name"
							label="Name"
							placeholder={`Enter ${label.toLowerCase()} name`}
							disabled={form.formState.isSubmitting}
							autoFocus
						/>

						<FormTextarea
							name="description"
							label="Description"
							placeholder={`Optional description for your cloned ${label.toLowerCase()}`}
							disabled={form.formState.isSubmitting}
							rows={3}
						/>

						{project.project_type !== "SKILL" && (
							<FormSwitch
								name="isGlobal"
								label="Make Public"
								description={`Allow all users to discover and view this ${label.toLowerCase()}.`}
								disabled={form.formState.isSubmitting}
							/>
						)}
					</FieldGroup>

					{form.formState.errors.root?.server?.message ? (
						<Alert variant="destructive">
							<AlertDescription>
								{form.formState.errors.root.server.message}
							</AlertDescription>
						</Alert>
					) : null}

					<DialogFooter className="mt-4">
						<Button
							type="button"
							variant="outline"
							disabled={form.formState.isSubmitting}
							onClick={() => onClose()}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={form.formState.isSubmitting}
						>
							{form.formState.isSubmitting && (
								<Spinner className="mr-2 size-4" />
							)}
							Clone
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
