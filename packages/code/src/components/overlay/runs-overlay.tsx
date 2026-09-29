import { useEffect, useState } from "react";
import type { Session } from "@semoss/agent-core";
import { Spinner } from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";

export interface RunsOverlayProps {
	open: boolean;
	onDismiss: () => void;
	session: Session | null;
}

interface RunEntry {
	id: string;
	timestamp: Date;
	prompt: string;
	status: "completed" | "failed" | "cancelled" | "running";
	duration?: number;
}

/**
 * The `:runs` overlay — browse run history for the current room. Shows
 * timestamps, prompts, status, and duration. Phase 4b.
 */
export const RunsOverlay = ({ open, onDismiss, session }: RunsOverlayProps) => {
	const [loading, setLoading] = useState(true);
	const [runs, setRuns] = useState<RunEntry[]>([]);

	useEffect(() => {
		if (!open || !session) {
			return;
		}

		// Extract run entries from session state
		setLoading(true);
		const state = session.getState();
		const runEntries: RunEntry[] = [];

		// Walk through entries and extract run information
		for (const entry of state.entries) {
			if (entry.kind === "run") {
				// Get prompt text - entry.prompt is a string
				const prompt =
					typeof entry.prompt === "string"
						? entry.prompt
						: "(empty prompt)";

				// Determine status from entry.status
				let status: RunEntry["status"] = "completed";
				if (typeof entry.status === "string") {
					// Status might be a simple string like "COMPLETED", "FAILED", etc.
					const statusStr = entry.status.toUpperCase();
					if (statusStr.includes("FAIL")) {
						status = "failed";
					} else if (statusStr.includes("CANCEL")) {
						status = "cancelled";
					} else if (
						statusStr.includes("RUNNING") ||
						statusStr.includes("SUBMITTED")
					) {
						status = "running";
					}
				}

				runEntries.push({
					id: entry.runId || `run-${runEntries.length}`,
					timestamp: new Date(), // TODO: extract from entry if available
					prompt: prompt || "(empty prompt)",
					status,
					duration: undefined, // TODO: calculate from timestamps
				});
			}
		}

		setRuns(runEntries);
		setLoading(false);
	}, [open, session]);

	const formatTimestamp = (date: Date) => {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return "just now";
	};

	const getStatusColor = (status: RunEntry["status"]) => {
		switch (status) {
			case "completed":
				return "text-green-600 dark:text-green-400";
			case "failed":
				return "text-red-600 dark:text-red-400";
			case "cancelled":
				return "text-yellow-600 dark:text-yellow-400";
			case "running":
				return "text-blue-600 dark:text-blue-400";
		}
	};

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":runs">
			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Spinner />
				</div>
			) : runs.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono text-muted-foreground text-sm">
						No runs yet
					</p>
					<p className="text-muted-foreground text-xs">
						Send a prompt to start your first run
					</p>
				</div>
			) : (
				<div className="space-y-1">
					<p className="mb-4 font-mono text-muted-foreground text-sm">
						Run history ({runs.length} total)
					</p>
					<div className="space-y-2">
						{runs.map((run, index) => (
							<div
								key={run.id || index}
								className="flex flex-col gap-1 rounded border p-3 hover:bg-accent/50"
							>
								<div className="flex items-center justify-between">
									<span className="font-mono text-muted-foreground text-xs">
										{formatTimestamp(run.timestamp)}
									</span>
									<span
										className={`font-medium font-mono text-xs ${getStatusColor(run.status)}`}
									>
										{run.status}
									</span>
								</div>
								<p className="font-mono text-sm">
									{run.prompt.length > 100
										? `${run.prompt.slice(0, 100)}…`
										: run.prompt}
								</p>
								{run.duration !== undefined && (
									<span className="font-mono text-muted-foreground text-xs">
										{(run.duration / 1000).toFixed(1)}s
									</span>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</OverlayContainer>
	);
};
