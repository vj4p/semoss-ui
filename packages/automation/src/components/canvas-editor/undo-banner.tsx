import { X } from "lucide-react";
import { Button } from "@semoss/ui/next";

/** Props for {@link UndoBanner}. */
interface UndoBannerProps {
	onUndo: () => void;
	onDismiss: () => void;
	/** The undo is being saved */
	busy?: boolean;
}

/** Offers to put an automation back as it was before the assistant changed it. */
export function UndoBanner({
	onUndo,
	onDismiss,
	busy = false,
}: UndoBannerProps) {
	return (
		<output className="flex items-center justify-between gap-3 rounded-lg border border-warning/50 bg-warning-tint px-3 py-1 text-xs">
			<span className="text-warning">AI updated your automation.</span>
			<div className="flex items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onUndo}
					disabled={busy}
					className="font-medium text-warning underline"
				>
					{busy ? "Undoing..." : "Undo"}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={onDismiss}
					disabled={busy}
					aria-label="Dismiss"
					className="text-warning"
				>
					<X aria-hidden="true" />
				</Button>
			</div>
		</output>
	);
}
