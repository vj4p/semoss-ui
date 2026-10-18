import {
	STATUS_LABELS,
	STATUS_TEXT_CLASS,
	statusKindFromBackend,
} from "@semoss/ui/next";

/** How the runs overlay names and colors a run's status. */
export interface RunStatusView {
	label: string;
	className: string;
}

/** LOST is the console's own state: it stopped hearing about the run, which may still be working. */
const LOST: RunStatusView = {
	label: "Lost contact",
	className: "text-warning",
};

/**
 * The words and color for a run status. A state the platform does not know is
 * shown as itself in a neutral color, never as a success.
 */
export const describeRunStatus = (raw: string): RunStatusView => {
	if (raw.toUpperCase() === "LOST") {
		return LOST;
	}
	const kind = statusKindFromBackend(raw);
	return kind
		? { label: STATUS_LABELS[kind], className: STATUS_TEXT_CLASS[kind] }
		: { label: raw.toLowerCase(), className: "text-muted-foreground" };
};
