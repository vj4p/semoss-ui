import type { ReactNode } from "react";
import { cn } from "@semoss/ui/next";

export interface Badge {
	label: string;
	variant: "default" | "primary" | "success" | "warning";
	icon?: ReactNode;
}

export interface SelectableCardProps {
	id: string;
	title: string;
	description: string;
	icon?: ReactNode;
	selected: boolean;
	disabled?: boolean;
	multiSelect: boolean;
	onSelect: (id: string, selected: boolean) => void;
	badges?: Badge[];
	metadata?: ReactNode;
	className?: string;
}

/**
 * Reusable selectable card component.
 * Supports both single-select (radio) and multi-select (checkbox) modes.
 */
export function SelectableCard({
	id,
	title,
	description,
	icon,
	selected,
	disabled = false,
	multiSelect,
	onSelect,
	badges = [],
	metadata,
	className,
}: SelectableCardProps) {
	const handleClick = () => {
		if (disabled) return;
		onSelect(id, !selected);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (disabled) return;
		if (e.key === " " || e.key === "Enter") {
			e.preventDefault();
			onSelect(id, !selected);
		}
	};

	return (
		<button
			type="button"
			role={multiSelect ? "checkbox" : "radio"}
			disabled={disabled}
			data-selected={selected}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			className={cn(
				"flex flex-col gap-2 rounded-lg border p-4 text-left transition-all",
				selected
					? "border-primary bg-accent"
					: "border-border bg-background",
				!disabled && "cursor-pointer hover:border-primary/50",
				disabled && "cursor-not-allowed opacity-50",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				className,
			)}
		>
			<div className="flex items-start gap-3">
				{/* Selection indicator */}
				<div className="flex h-5 w-5 items-center justify-center">
					{multiSelect ? (
						<input
							type="checkbox"
							checked={selected}
							disabled={disabled}
							onChange={() => {}}
							className="h-4 w-4 rounded border-border"
							tabIndex={-1}
							data-testid="select-card-checkbox"
						/>
					) : (
						<input
							type="radio"
							checked={selected}
							disabled={disabled}
							onChange={() => {}}
							className="h-4 w-4 border-border"
							tabIndex={-1}
							data-testid="select-card-radio"
						/>
					)}
				</div>

				{/* Icon */}
				{icon && (
					<div className="flex h-5 w-5 items-center justify-center text-muted-foreground">
						{icon}
					</div>
				)}

				{/* Title and badges */}
				<div className="flex flex-1 flex-col gap-1">
					<div className="flex items-center gap-2">
						<h3 className="font-medium text-sm">{title}</h3>
						{badges.length > 0 && (
							<div className="flex gap-1">
								{badges.map((badge) => (
									<span
										key={`${badge.label}-${badge.variant}`}
										className={cn(
											"inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs",
											badge.variant === "default" &&
												"bg-muted text-muted-foreground",
											badge.variant === "primary" &&
												"bg-primary/10 text-primary",
											badge.variant === "success" &&
												"bg-green-500/10 text-green-700 dark:text-green-400",
											badge.variant === "warning" &&
												"bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
										)}
									>
										{badge.icon}
										{badge.label}
									</span>
								))}
							</div>
						)}
					</div>

					{/* Description */}
					<p className="text-muted-foreground text-sm">
						{description}
					</p>

					{/* Metadata */}
					{metadata && <div className="mt-2">{metadata}</div>}
				</div>
			</div>
		</button>
	);
}
