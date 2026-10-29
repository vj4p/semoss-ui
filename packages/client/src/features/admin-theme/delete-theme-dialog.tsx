import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Spinner,
} from "@semoss/ui/next";

export interface DeleteThemeDialogProps {
	/** Whether the dialog is open */
	open: boolean;
	/** The theme's name, shown in the question */
	themeName: string;
	/** Whether the theme is the one the instance currently uses */
	isActive: boolean;
	/** Whether the delete request is running */
	isDeleting: boolean;
	/** Called when the person confirms */
	onConfirm: () => void;
	/** Called when the person cancels or dismisses the dialog */
	onCancel: () => void;
}

/**
 * Asks before deleting an admin theme, since a deleted theme cannot be
 * restored. Dismissal is held back while the request runs.
 */
export const DeleteThemeDialog = ({
	open,
	themeName,
	isActive,
	isDeleting,
	onConfirm,
	onCancel,
}: DeleteThemeDialogProps) => (
	<Dialog
		open={open}
		onOpenChange={(isOpen) => {
			if (!isOpen && !isDeleting) {
				onCancel();
			}
		}}
	>
		<DialogContent
			showCloseButton={!isDeleting}
			onEscapeKeyDown={(event) => {
				if (isDeleting) {
					event.preventDefault();
				}
			}}
			onInteractOutside={(event) => {
				if (isDeleting) {
					event.preventDefault();
				}
			}}
		>
			<DialogHeader>
				<DialogTitle className="font-medium text-base leading-6">
					Delete theme
				</DialogTitle>
				<DialogDescription>
					{isActive
						? `Deleting ${themeName} also switches the instance back to the default look. This cannot be undone.`
						: `Deleting ${themeName} removes its settings. This cannot be undone.`}
				</DialogDescription>
			</DialogHeader>
			<DialogFooter>
				<Button
					type="button"
					variant="outline"
					disabled={isDeleting}
					onClick={onCancel}
				>
					Cancel
				</Button>
				<Button
					type="button"
					variant="destructive"
					disabled={isDeleting}
					onClick={onConfirm}
				>
					{isDeleting ? <Spinner className="size-4" /> : null}
					{isDeleting ? "Deleting..." : "Delete theme"}
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
);
