/** How the runs overlay names and colors a run's status. */
export interface RunStatusView {
	label: string;
	className: string;
}

const STATUS_VIEWS: Record<string, RunStatusView> = {
	COMPLETED: { label: "Done", className: "text-success" },
	FAILED: { label: "Failed", className: "text-destructive" },
	CANCELLED: { label: "Cancelled", className: "text-muted-foreground" },
	REJECTED: { label: "Denied", className: "text-muted-foreground" },
	RUNNING: { label: "Running", className: "text-primary-text" },
	STARTING: { label: "Running", className: "text-primary-text" },
	INPUT_REQUIRED: { label: "Waiting on you", className: "text-warning" },
	QUEUED: { label: "Queued", className: "text-muted-foreground" },
	SUBMITTED: { label: "Queued", className: "text-muted-foreground" },
	LOST: { label: "Lost contact", className: "text-warning" },
};

/**
 * The words and color for a run status. A state this table does not know is
 * shown as itself in a neutral color, never as a success.
 */
export const describeRunStatus = (raw: string): RunStatusView =>
	STATUS_VIEWS[raw.toUpperCase()] ?? {
		label: raw.toLowerCase(),
		className: "text-muted-foreground",
	};
