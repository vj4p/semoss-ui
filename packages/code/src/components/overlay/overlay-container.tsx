import { XIcon } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Trans, useTranslation } from "@semoss/i18n";
import { Button, Dialog, DialogContent, DialogTitle } from "@semoss/ui/next";

/** A key name in the close hint: a keycap, so it stays left-to-right in every language. */
const KEY_CLASS = "rounded border px-1.5 py-0.5";

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
	const { t } = useTranslation("code");

	useEffect(() => {
		if (!open) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "q" && !event.metaKey && !event.ctrlKey) {
				// Only dismiss on bare 'q', not Cmd+Q or Ctrl+Q
				const target = event.target as HTMLElement;
				// Allow 'q' in input/textarea elements INSIDE the overlay content
				// (search boxes, etc.), but not in elements outside the overlay
				const isInsideOverlay = target.closest(
					'[data-slot="dialog-content"]',
				);
				const isInput =
					target.tagName === "INPUT" || target.tagName === "TEXTAREA";

				if (isInput && isInsideOverlay) {
					// Let the user type 'q' in overlay inputs (like search boxes)
					return;
				}

				// Otherwise, close the overlay
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
				showCloseButton={false}
				// Prevent Dialog from auto-focusing the close button
				onOpenAutoFocus={(e) => e.preventDefault()}
				// An overlay opens from a command typed in the prompt, not from a
				// button, so there is no trigger for the dialog to give focus back
				// to. Without this focus falls to the page and a keyboard user has to
				// tab back to the prompt.
				onCloseAutoFocus={(e) => {
					const prompt = document.querySelector<HTMLElement>(
						"[data-console-prompt]",
					);
					if (prompt) {
						e.preventDefault();
						prompt.focus();
					}
				}}
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
						aria-label={t("overlay.close")}
					>
						<XIcon aria-hidden="true" />
					</Button>
				</div>
				<div className="flex-1 overflow-y-auto px-6 py-4">
					{children}
				</div>
				<div className="border-t px-6 py-2">
					<p className="font-mono text-muted-foreground text-sm">
						<Trans
							t={t}
							i18nKey="overlay.closeHint"
							components={{
								keyQ: <kbd dir="ltr" className={KEY_CLASS} />,
								keyEsc: <kbd dir="ltr" className={KEY_CLASS} />,
							}}
						/>
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
};
