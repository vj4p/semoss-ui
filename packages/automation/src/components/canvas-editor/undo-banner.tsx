interface UndoBannerProps {
	onUndo: () => void;
	onDismiss: () => void;
	/** The undo is being saved */
	busy?: boolean;
}

export function UndoBanner({
	onUndo,
	onDismiss,
	busy = false,
}: UndoBannerProps) {
	return (
		<div className="flex items-center justify-between rounded-lg border border-warning/50 bg-warning-tint px-3 py-2 text-xs">
			<span className="text-warning">AI updated your automation.</span>
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={onUndo}
					disabled={busy}
					className="font-medium text-warning underline hover:text-warning disabled:opacity-50"
				>
					{busy ? "Undoing..." : "Undo"}
				</button>
				<button
					type="button"
					onClick={onDismiss}
					disabled={busy}
					className="text-warning hover:text-warning disabled:opacity-50"
					aria-label="Dismiss"
				>
					✕
				</button>
			</div>
		</div>
	);
}
