import type { CompletionItem } from "@semoss/agent-core";

export interface CompletionMenuProps {
	items: CompletionItem[];
	selectedIndex: number;
	onSelect: (item: CompletionItem) => void;
	onDismiss: () => void;
}

/**
 * Completion menu displayed below the prompt input when Tab is pressed.
 * Shows available completions with keyboard navigation.
 */
export const CompletionMenu = ({
	items,
	selectedIndex,
	onSelect,
	onDismiss: _onDismiss,
}: CompletionMenuProps) => {
	if (items.length === 0) {
		return null;
	}

	return (
		<div
			className="absolute z-50 mt-1 w-full max-w-md rounded-md border bg-popover shadow-lg"
			role="listbox"
		>
			<div className="max-h-60 overflow-y-auto p-1">
				{items.map((item, index) => (
					<button
						key={`${item.value}-${index}`}
						type="button"
						onClick={() => onSelect(item)}
						className={`flex w-full flex-col items-start gap-0.5 rounded px-3 py-2 text-left transition-colors ${
							index === selectedIndex
								? "bg-accent text-accent-foreground"
								: "hover:bg-accent/50"
						}`}
						role="option"
						aria-selected={index === selectedIndex}
					>
						<div className="flex items-center gap-2">
							{item.kind && (
								<span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
									{item.kind}
								</span>
							)}
							<span className="font-mono text-sm">
								{item.label}
							</span>
						</div>
						{item.description &&
							item.description !== item.label && (
								<span className="text-muted-foreground text-xs">
									{item.description}
								</span>
							)}
					</button>
				))}
			</div>
			<div className="border-t px-3 py-1.5">
				<p className="text-muted-foreground text-xs">
					↑↓ to navigate • Tab/Enter to complete • Esc to dismiss
				</p>
			</div>
		</div>
	);
};
