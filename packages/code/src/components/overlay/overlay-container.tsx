import { XIcon } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Button, Dialog, DialogContent, DialogTitle } from "@semoss/ui/next";

export interface OverlayContainerProps {
	/** Whether the overlay is open. */
	open: boolean;
	/** Called when the overlay should close (q, Escape, or close button). */
	onDismiss: () => void;
	/** The overlay's title. */
	title: string;
	/** The overlay content. */
	children: ReactNode;
}

/**
 * A full-screen terminal-style overlay, dismissed with `q` or Escape. The
 * pattern for every overlay command (`:files`, `:diff`, `:runs`, etc.). Traps
 * focus and restores it to the prompt on dismiss.
 */
export const OverlayContainer = ({
	open,
	onDismiss,
	title,
	children,
}: OverlayContainerProps) => {
	useEffect(() => {
		if (!open) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "q" && !event.metaKey && !event.ctrlKey) {
				// Only dismiss on bare 'q', not Cmd+Q or Ctrl+Q
				const target = event.target as HTMLElement;
				// Allow 'q' in input/textarea elements
				if (
					target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA"
				) {
					return;
				}
				event.preventDefault();
				onDismiss();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [open, onDismiss]);

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
			<DialogContent
				className="flex h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] w-[calc(100vw-4rem)] max-w-[calc(100vw-4rem)] flex-col gap-0 p-0"
				// Prevent Dialog from auto-focusing the close button
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<div className="flex items-center justify-between border-b px-6 py-4">
					<DialogTitle className="font-mono font-semibold text-lg">
						{title}
					</DialogTitle>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onDismiss}
						data-testid="overlay-close"
						aria-label="Close"
					>
						<XIcon />
					</Button>
				</div>
				<div className="flex-1 overflow-y-auto px-6 py-4">
					{children}
				</div>
				<div className="border-t px-6 py-2">
					<p className="font-mono text-muted-foreground text-sm">
						Press{" "}
						<kbd className="rounded border px-1.5 py-0.5">q</kbd> or{" "}
						<kbd className="rounded border px-1.5 py-0.5">Esc</kbd>{" "}
						to close
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
};
