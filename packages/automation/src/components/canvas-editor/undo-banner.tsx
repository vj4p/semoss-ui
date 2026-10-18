interface UndoBannerProps {
	onUndo: () => void;
	onDismiss: () => void;
}

export function UndoBanner({ onUndo, onDismiss }: UndoBannerProps) {
	return (
		<div className="flex items-center justify-between rounded-lg border border-warning/50 bg-warning-tint px-3 py-2 text-xs">
			<span className="text-warning">AI updated your automation.</span>
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={onUndo}
					className="font-medium text-warning underline hover:text-warning"
				>
					Undo
				</button>
				<button
					type="button"
					onClick={onDismiss}
					className="text-warning hover:text-warning"
					aria-label="Dismiss"
				>
					✕
				</button>
			</div>
		</div>
	);
}
