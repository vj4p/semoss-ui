import { cn } from "@/lib/utils";

export type StatusKind =
	| "queued"
	| "running"
	| "waiting"
	| "done"
	| "failed"
	| "denied"
	| "cancelled";

/** The default English words. Hosts that translate pass `label` instead. */
export const STATUS_LABELS: Readonly<Record<StatusKind, string>> = {
	queued: "Queued",
	running: "Running",
	waiting: "Waiting on you",
	done: "Done",
	failed: "Failed",
	denied: "Denied",
	cancelled: "Cancelled",
};

/** Text colour per status, for glyphs and inline text. */
export const STATUS_TEXT_CLASS: Readonly<Record<StatusKind, string>> = {
	queued: "text-muted-foreground",
	running: "text-primary-text motion-safe:animate-pulse",
	waiting: "text-warning",
	done: "text-success",
	failed: "text-destructive",
	denied: "text-muted-foreground",
	cancelled: "text-muted-foreground",
};

const BADGE_CLASS: Readonly<Record<StatusKind, string>> = {
	queued: "bg-muted text-muted-foreground",
	running: "bg-accent text-primary-text",
	waiting: "bg-warning-tint text-warning",
	done: "bg-success-tint text-success",
	failed: "bg-destructive-tint text-destructive",
	denied: "bg-muted text-muted-foreground",
	cancelled: "bg-muted text-muted-foreground",
};

const BACKEND_KIND: Readonly<Record<string, StatusKind>> = {
	QUEUED: "queued",
	SUBMITTED: "queued",
	INITIAL: "queued",
	RUNNING: "running",
	STARTING: "running",
	LOADING: "running",
	INPUT_REQUIRED: "waiting",
	WAITING: "waiting",
	COMPLETED: "done",
	SUCCESS: "done",
	FAILED: "failed",
	ERROR: "failed",
	REJECTED: "denied",
	CANCELLED: "cancelled",
};

/**
 * Maps a backend status string to a status, or undefined when it is not one
 * the platform knows. Callers show an unknown value as itself, never as done.
 */
export const statusKindFromBackend = (
	value: string | null | undefined,
): StatusKind | undefined =>
	value ? BACKEND_KIND[value.trim().toUpperCase()] : undefined;

export interface StatusBadgeProps {
	status: StatusKind;
	/** Overrides the default English word, for translation or a more specific name. */
	label?: string;
	className?: string;
}

/**
 * A status as a small chip: a dot, and always the word. The dot only repeats
 * the colour, so the status never depends on colour alone.
 */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
	return (
		<span
			data-slot="status-badge"
			data-status={status}
			className={cn(
				"inline-flex h-5 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 font-medium text-xs",
				BADGE_CLASS[status],
				className,
			)}
		>
			<span
				aria-hidden="true"
				className={cn(
					"size-1.5 rounded-full bg-current",
					status === "running" && "motion-safe:animate-pulse",
				)}
			/>
			{label ?? STATUS_LABELS[status]}
		</span>
	);
}
