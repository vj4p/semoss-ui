import { ChevronRightIcon, RefreshCw } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";
import {
	Badge,
	Button,
	ScrollArea,
	Skeleton,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@semoss/ui/next";
import type { RoomStore } from "@/stores";
import {
	type AgentHarnessType,
	isAgentHarnessType,
} from "@/stores/message/agent-harness";

/** One row from GetAgentRunsForRoom — see AgentRunStore's column mapping. */
interface AgentRunRow {
	runId?: string;
	parentRunId?: string | null;
	roomId?: string;
	harnessType?: string;
	modelId?: string;
	status?: string;
	input?: string;
	finalText?: string;
	errorMessage?: string | null;
	startedAt?: string | number | null;
	completedAt?: string | number | null;
	dateCreated?: string | number | null;
}

/**
 * Harnesses whose transcript lives outside the platform's own message tables,
 * so reopening a past run means asking that harness for its own history.
 */
const TRANSCRIPT_PIXEL: Partial<Record<AgentHarnessType, string>> = {
	claude_code: "GetClaudeCodeTranscriptHistory",
	github_copilot_py: "GetGitHubCopilotTranscriptHistory",
};

const statusVariant = (status?: string) => {
	switch (status) {
		case "COMPLETED":
			return "default" as const;
		case "FAILED":
			return "destructive" as const;
		default:
			return "secondary" as const;
	}
};

const parseTime = (value?: string | number | null): number | null => {
	if (value === null || value === undefined || value === "") {
		return null;
	}
	const ms = typeof value === "number" ? value : Date.parse(String(value));
	return Number.isFinite(ms) ? ms : null;
};

const formatWhen = (value?: string | number | null) => {
	const ms = parseTime(value);
	return ms === null ? "—" : new Date(ms).toLocaleString();
};

const formatDuration = (
	from?: string | number | null,
	to?: string | number | null,
) => {
	const a = parseTime(from);
	const b = parseTime(to);
	if (a === null || b === null || b < a) {
		return null;
	}
	const ms = b - a;
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
	return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
};

interface RoomRunHistoryProps {
	room: RoomStore;
}

/**
 * Past agent runs for this room.
 *
 * Backed by GetAgentRunsForRoom, which returns only top-level runs (subagents
 * are reachable through GetSubagentRuns via parentRunId) in chronological
 * order. `includeMessages` is left off — this is a list, and enriching every
 * row would fetch each run's full message set.
 *
 * For the subprocess harnesses the platform's message tables are not the whole
 * story, so expanding a run asks that harness for its own transcript. That is
 * the only way to see what a past claude_code run actually did.
 */
export const RoomRunHistory: React.FC<RoomRunHistoryProps> = observer(
	({ room }) => {
		const [runs, setRuns] = useState<AgentRunRow[]>([]);
		const [loading, setLoading] = useState(false);
		const [error, setError] = useState<string | null>(null);
		const [expanded, setExpanded] = useState<string | null>(null);
		const [transcripts, setTranscripts] = useState<
			Record<string, { loading: boolean; text: string; error?: string }>
		>({});

		const fetchRuns = useCallback(async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await room.runRoomPixel<[AgentRunRow[]]>(
					`GetAgentRunsForRoom(roomId=${JSON.stringify(room.roomId)});`,
					false,
				);
				const { operationType, output } = response.pixelReturn[0];
				if (operationType.indexOf("ERROR") > -1) {
					throw new Error(
						typeof output === "string"
							? output
							: "Failed to load run history",
					);
				}
				// Newest first reads better in a side panel, even though the
				// reactor hands back chronological order for playback.
				setRuns([...(output ?? [])].reverse());
			} catch (e) {
				setError((e as Error).message || "Failed to load run history");
			} finally {
				setLoading(false);
			}
		}, [room]);

		useEffect(() => {
			void fetchRuns();
		}, [fetchRuns]);

		const toggle = async (run: AgentRunRow) => {
			const runId = run.runId;
			if (!runId) {
				return;
			}
			if (expanded === runId) {
				setExpanded(null);
				return;
			}
			setExpanded(runId);

			const harness = isAgentHarnessType(run.harnessType)
				? run.harnessType
				: undefined;
			const pixel = harness ? TRANSCRIPT_PIXEL[harness] : undefined;
			// Native runs already have their messages in the thread, and rows
			// fetched once are cached.
			if (!pixel || transcripts[runId]) {
				return;
			}

			setTranscripts((prev) => ({
				...prev,
				[runId]: { loading: true, text: "" },
			}));
			try {
				const response = await room.runRoomPixel<[unknown]>(
					`${pixel}(roomId=${JSON.stringify(room.roomId)});`,
					false,
				);
				const { operationType, output } = response.pixelReturn[0];
				if (operationType.indexOf("ERROR") > -1) {
					throw new Error("Transcript unavailable");
				}
				setTranscripts((prev) => ({
					...prev,
					[runId]: {
						loading: false,
						text:
							typeof output === "string"
								? output
								: JSON.stringify(output, null, 2),
					},
				}));
			} catch (e) {
				setTranscripts((prev) => ({
					...prev,
					[runId]: {
						loading: false,
						text: "",
						error: (e as Error).message || "Transcript unavailable",
					},
				}));
			}
		};

		return (
			<div className="flex h-full flex-col">
				<div className="flex items-center gap-2 border-border border-b px-3 py-2">
					<span className="font-semibold text-sm">Run history</span>
					{runs.length > 0 ? (
						<Badge variant="secondary">{runs.length}</Badge>
					) : null}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								size="sm"
								variant="ghost"
								className="ml-auto"
								disabled={loading}
								onClick={() => void fetchRuns()}
							>
								<RefreshCw className="size-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Refresh</TooltipContent>
					</Tooltip>
				</div>

				<ScrollArea className="flex-1">
					<div className="space-y-2 p-3">
						{loading && runs.length === 0 ? (
							<>
								<Skeleton className="h-16 w-full" />
								<Skeleton className="h-16 w-full" />
							</>
						) : null}

						{error ? (
							<div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm">
								{error}
							</div>
						) : null}

						{!loading && !error && runs.length === 0 ? (
							<div className="rounded-md border border-border border-dashed p-6 text-center text-muted-foreground text-sm">
								No agent runs in this room yet.
							</div>
						) : null}

						{runs.map((run) => {
							const runId = run.runId ?? "";
							const isOpen = expanded === runId;
							const duration = formatDuration(
								run.startedAt,
								run.completedAt,
							);
							const transcript = transcripts[runId];
							const hasTranscript =
								isAgentHarnessType(run.harnessType) &&
								!!TRANSCRIPT_PIXEL[run.harnessType];

							return (
								<div
									key={runId}
									className="rounded-md border border-border bg-card"
								>
									<button
										type="button"
										className="flex w-full cursor-pointer items-start gap-2 p-3 text-start"
										onClick={() => void toggle(run)}
										aria-expanded={isOpen}
									>
										<ChevronRightIcon
											className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${
												isOpen ? "rotate-90" : ""
											}`}
										/>
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<span className="font-mono text-muted-foreground text-xs">
													{runId.slice(0, 8)}
												</span>
												<Badge
													variant={statusVariant(
														run.status,
													)}
												>
													{run.status ?? "—"}
												</Badge>
												{run.harnessType ? (
													<Badge variant="outline">
														{run.harnessType}
													</Badge>
												) : null}
												{duration ? (
													<span className="text-muted-foreground text-xs tabular-nums">
														{duration}
													</span>
												) : null}
											</div>
											{run.input ? (
												<div className="mt-1 line-clamp-2 text-sm">
													{run.input}
												</div>
											) : null}
											<div className="mt-1 text-muted-foreground text-xs">
												{formatWhen(
													run.startedAt ??
														run.dateCreated,
												)}
											</div>
										</div>
									</button>

									{isOpen ? (
										<div className="border-border border-t p-3">
											{run.errorMessage ? (
												<div className="mb-2 rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs">
													{run.errorMessage}
												</div>
											) : null}

											{run.finalText ? (
												<div className="whitespace-pre-wrap text-sm">
													{run.finalText}
												</div>
											) : null}

											{hasTranscript ? (
												<div className="mt-2">
													<div className="mb-1 font-medium text-muted-foreground text-xs">
														Harness transcript
													</div>
													{transcript?.loading ? (
														<Skeleton className="h-16 w-full" />
													) : transcript?.error ? (
														<div className="text-muted-foreground text-xs">
															{transcript.error}
														</div>
													) : transcript?.text ? (
														<pre className="max-h-64 overflow-auto rounded bg-secondary p-2 font-mono text-xs">
															{transcript.text}
														</pre>
													) : null}
												</div>
											) : null}

											{!run.errorMessage &&
											!run.finalText &&
											!hasTranscript ? (
												<div className="text-muted-foreground text-xs">
													This run's messages are in
													the conversation above.
												</div>
											) : null}
										</div>
									) : null}
								</div>
							);
						})}
					</div>
				</ScrollArea>
			</div>
		);
	},
);
