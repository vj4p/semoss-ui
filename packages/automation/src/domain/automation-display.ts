import {
	Archive,
	Bolt,
	Clock,
	Cpu,
	Database,
	GitBranch,
	LayoutGrid,
	ListTree,
	type LucideIcon,
	Play,
	Repeat2,
	Sigma,
} from "lucide-react";
import { formatDurationMs } from "@semoss/utility/date";
import type { AutomationNode, AutomationNodeType } from "./automation.types";

export const STEP_TYPES: {
	type: AutomationNodeType;
	label: string;
	description: string;
	icon: LucideIcon;
	color: string;
}[] = [
	{
		type: "database-engine",
		label: "Query Database",
		description: "Run a query or write against a connected database",
		icon: Database,
		color: "text-info",
	},
	{
		type: "model-engine",
		label: "Ask AI",
		description: "Send a prompt to an AI model and get a response",
		icon: Cpu,
		color: "text-chart-4",
	},
	{
		type: "vector-engine",
		label: "Search Documents",
		description: "Find relevant documents using semantic search",
		icon: Bolt,
		color: "text-warning",
	},
	{
		type: "storage-engine",
		label: "File Storage",
		description: "Upload, download, or list files in cloud storage",
		icon: Archive,
		color: "text-success",
	},
	{
		type: "function-engine",
		label: "Run Function",
		description: "Call a custom function or external API",
		icon: Sigma,
		color: "text-info",
	},
	{
		type: "data",
		label: "Extract Value",
		description: "Read one value from JSON, XML, or a downloaded file",
		icon: ListTree,
		color: "text-chart-2",
	},
	{
		type: "app",
		label: "Run App",
		description: "Run a custom function from this app",
		icon: LayoutGrid,
		color: "text-muted-foreground",
	},
	{
		type: "wait",
		label: "Delay",
		description: "Pause execution for a fixed number of seconds",
		icon: Clock,
		color: "text-info",
	},
];

// Two namespaces in one map: UPPERCASE keys match RunStatus/NodeStatus from the
// backend (PENDING, RUNNING, SUCCESS, FAILED, SKIPPED, INTERRUPTED, CANCELLED);
// lowercase keys match the FE-only StepRunStatus used during live poll (idle,
// running, waiting, success, error). getStatusClasses() handles both.
export const STATUS_STYLES: Record<string, string> = {
	PENDING: "bg-muted text-muted-foreground",
	RUNNING: "bg-primary/10 text-primary-text",
	WAITING_FOR_INPUT: "bg-warning/10 text-warning",
	SUCCESS: "bg-success/10 text-success",
	FAILED: "bg-destructive/10 text-destructive",
	SKIPPED: "bg-muted text-muted-foreground ",
	INTERRUPTED: "bg-warning/10 text-warning",
	CANCELLED: "bg-muted text-muted-foreground ",
	error: "bg-destructive/10 text-destructive",
	success: "bg-success/10 text-success",
	running: "bg-primary/10 text-primary-text",
	waiting: "bg-warning/10 text-warning",
	idle: "bg-muted text-muted-foreground",
};

export const TYPE_DISPLAY_META: Record<
	string,
	{
		label: string;
		description: string;
		icon: LucideIcon;
		color: string;
	}
> = {
	trigger: {
		label: "Trigger",
		description: "Start the automation manually",
		icon: Play,
		color: "text-success",
	},
	"database-engine": STEP_TYPES[0],
	"model-engine": STEP_TYPES[1],
	"vector-engine": STEP_TYPES[2],
	"storage-engine": STEP_TYPES[3],
	"function-engine": STEP_TYPES[4],
	data: STEP_TYPES[5],
	app: STEP_TYPES[6],
	wait: STEP_TYPES[7],
	loop: {
		label: "Loop over items",
		description: "Repeat a nested sequence for every item or batch",
		icon: Repeat2,
		color: "text-primary-text",
	},
	branch: {
		label: "Decision",
		description: "Evaluate a condition and route to the matching path",
		icon: GitBranch,
		color: "text-warning",
	},
};

/**
 * DB timestamps come back as "YYYY-MM-DD HH:MM:SS.s" with no timezone marker but
 * are stored as UTC. Appending "Z" tells JS to interpret them as UTC, not local time.
 */
function parseUtcDate(iso: string): Date {
	if (!iso) return new Date(Number.NaN);
	const s = iso.trim();
	// Already has timezone info — trust it
	if (s.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
	// Bare datetime (space or T separator) — normalize to ISO 8601 UTC
	return new Date(`${s.replace(" ", "T").replace(/\.\d+$/, "")}Z`);
}

export function formatTimestamp(iso: string): string {
	try {
		return parseUtcDate(iso).toLocaleString();
	} catch {
		return iso;
	}
}

export function formatRelativeTime(iso: string): string {
	try {
		const ms = Date.now() - parseUtcDate(iso).getTime();
		if (ms < 60_000) return "just now";
		if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
		if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
		return parseUtcDate(iso).toLocaleDateString();
	} catch {
		return iso;
	}
}

export function getStatusClasses(status: string) {
	return STATUS_STYLES[status] ?? STATUS_STYLES.PENDING;
}

export function getDisplayMeta(type: AutomationNodeType | string) {
	return TYPE_DISPLAY_META[type] ?? TYPE_DISPLAY_META["database-engine"];
}

export function formatRunDuration(
	startedAt: string,
	completedAt: string | null,
): string {
	if (!completedAt) return "—";
	const ms =
		parseUtcDate(completedAt).getTime() - parseUtcDate(startedAt).getTime();
	return formatDurationMs(ms);
}

export function getStepHeaderLabel(step: AutomationNode) {
	const meta = getDisplayMeta(step.type);
	return step.label || meta.label;
}
