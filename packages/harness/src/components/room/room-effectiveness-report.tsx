import { RefreshCw } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";
import {
	Badge,
	Button,
	Progress,
	ScrollArea,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@semoss/ui/next";
import type { RoomStore } from "@/stores";

/** Shapes returned by GetAgentEffectiveness (reactor/agent/metrics). */
interface ScoreBlock {
	value?: number | null;
	components?: Record<string, number>;
	excludedReason?: string | null;
}

interface ToolBreakdown {
	calls?: number;
	failed?: number;
	unanswered?: number;
	serverToolCalls?: number;
	avgDurationMs?: number;
}

interface RunMetrics {
	runId?: string;
	harnessType?: string;
	modelId?: string;
	status?: string;
	wallClockMs?: number;
	outcome?: { errorMessage?: string | null; maxTurnsReached?: boolean };
	turns?: { assistantMessages?: number; toolRoundTrips?: number };
	tools?: { totalCalls?: number; failed?: number; successRate?: number };
	score?: ScoreBlock | null;
}

interface Rollup {
	runCount?: number;
	runsCompleted?: number;
	runsFailed?: number;
	runsCancelled?: number;
	runsInFlight?: number;
	runsHitMaxTurns?: number;
	runCompletionRate?: number;
	toolCalls?: number;
	toolFailures?: number;
	toolSuccessRate?: number;
	unansweredToolCalls?: number;
	unknownToolCalls?: number;
	malformedArgumentCalls?: number;
	duplicateCallWaste?: number;
	skillLoadCalls?: number;
	skillLoadFailures?: number;
	distinctSkillsLoaded?: number;
	averageScore?: number | null;
	scoredRuns?: number;
	byTool?: Record<string, ToolBreakdown>;
}

interface RoomInference {
	available?: boolean;
	llmCalls?: number;
	inputTokens?: number;
	outputTokens?: number;
	thinkingTokens?: number;
	cacheReadTokens?: number;
	cacheCreationTokens?: number;
	avgResponseTimeMs?: number;
	maxResponseTimeMs?: number;
}

interface EffectivenessOutput {
	roomId?: string;
	rollup?: Rollup;
	roomInference?: RoomInference;
	runs?: RunMetrics[];
}

const RUN_LIMIT = 50;

const formatNumber = (value?: number | null) =>
	typeof value === "number" && Number.isFinite(value)
		? value.toLocaleString()
		: "—";

const formatPercent = (value?: number | null) =>
	typeof value === "number" && Number.isFinite(value)
		? `${Math.round(value * 100)}%`
		: "—";

const formatDuration = (ms?: number | null) => {
	if (typeof ms !== "number" || !Number.isFinite(ms)) {
		return "—";
	}
	if (ms < 1000) {
		return `${Math.round(ms)}ms`;
	}
	if (ms < 60_000) {
		return `${(ms / 1000).toFixed(1)}s`;
	}
	return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
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

const Stat = ({
	label,
	value,
	hint,
}: {
	label: string;
	value: string;
	hint?: string;
}) => (
	<div className="rounded-md border border-border bg-card p-3">
		<div className="text-muted-foreground text-xs">{label}</div>
		<div className="mt-1 font-semibold text-lg tabular-nums">{value}</div>
		{hint ? (
			<div className="text-muted-foreground text-xs">{hint}</div>
		) : null}
	</div>
);

interface RoomEffectivenessReportProps {
	room: RoomStore;
}

/**
 * Agent-run telemetry for the current room, shown in the right side panel.
 *
 * Backed entirely by GetAgentEffectiveness, which recomputes on read from
 * AGENT_RUN + MESSAGE — nothing here is denormalized, so there is no cheap
 * long-range query and the run list is capped.
 */
export const RoomEffectivenessReport = observer(
	({ room }: RoomEffectivenessReportProps) => {
		const [data, setData] = useState<EffectivenessOutput | null>(null);
		const [loading, setLoading] = useState(false);
		const [error, setError] = useState<string | null>(null);

		const fetchReport = useCallback(async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await room.runRoomPixel<[EffectivenessOutput]>(
					`GetAgentEffectiveness(roomId=${JSON.stringify(
						room.roomId,
					)}, includeRuns=[true], limit=[${RUN_LIMIT}]);`,
					false,
				);
				const { operationType, output } = response.pixelReturn[0];
				if (operationType.indexOf("ERROR") > -1) {
					throw new Error(
						typeof output === "string"
							? output
							: "Failed to load agent telemetry",
					);
				}
				setData(output as EffectivenessOutput);
			} catch (e) {
				setError(
					(e as Error).message || "Failed to load agent telemetry",
				);
			} finally {
				setLoading(false);
			}
		}, [room]);

		useEffect(() => {
			void fetchReport();
		}, [fetchReport]);

		const rollup = data?.rollup ?? {};
		const inference = data?.roomInference ?? {};
		const runs = data?.runs ?? [];
		const byTool = Object.entries(rollup.byTool ?? {}).sort(
			(a, b) => (b[1].calls ?? 0) - (a[1].calls ?? 0),
		);

		return (
			<div className="flex h-full flex-col">
				<div className="flex items-center gap-2 border-border border-b px-3 py-2">
					<span className="font-semibold text-sm">
						Agent telemetry
					</span>
					{typeof rollup.averageScore === "number" ? (
						<Badge variant="secondary">
							avg score {Math.round(rollup.averageScore)}
						</Badge>
					) : null}
					<Button
						size="sm"
						variant="ghost"
						className="ml-auto"
						disabled={loading}
						onClick={() => void fetchReport()}
					>
						<RefreshCw className="size-4" />
					</Button>
				</div>

				<ScrollArea className="flex-1">
					<div className="space-y-4 p-3">
						{loading && !data ? (
							<div className="space-y-2">
								<Skeleton className="h-20 w-full" />
								<Skeleton className="h-20 w-full" />
								<Skeleton className="h-40 w-full" />
							</div>
						) : null}

						{error ? (
							<div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm">
								{error}
							</div>
						) : null}

						{!loading && !error && rollup.runCount === 0 ? (
							<div className="rounded-md border border-border border-dashed p-6 text-center text-muted-foreground text-sm">
								No agent runs in this room yet. Telemetry
								appears once a message runs through an agent
								harness.
							</div>
						) : null}

						{data && (rollup.runCount ?? 0) > 0 ? (
							<>
								<div className="grid grid-cols-2 gap-2">
									<Stat
										label="Runs"
										value={formatNumber(rollup.runCount)}
										hint={`${formatNumber(
											rollup.runsCompleted,
										)} completed · ${formatNumber(
											rollup.runsFailed,
										)} failed`}
									/>
									<Stat
										label="Run completion"
										value={formatPercent(
											rollup.runCompletionRate,
										)}
										hint={`${formatNumber(
											rollup.runsInFlight,
										)} in flight`}
									/>
									<Stat
										label="Tool calls"
										value={formatNumber(rollup.toolCalls)}
										hint={`${formatNumber(
											rollup.toolFailures,
										)} failed`}
									/>
									<Stat
										label="Tool success"
										value={formatPercent(
											rollup.toolSuccessRate,
										)}
										hint={`${formatNumber(
											rollup.unansweredToolCalls,
										)} unanswered`}
									/>
								</div>

								<section>
									<h4 className="mb-2 font-medium text-sm">
										Discipline
									</h4>
									<div className="grid grid-cols-2 gap-2">
										<Stat
											label="Unknown tools"
											value={formatNumber(
												rollup.unknownToolCalls,
											)}
										/>
										<Stat
											label="Malformed args"
											value={formatNumber(
												rollup.malformedArgumentCalls,
											)}
										/>
										<Stat
											label="Duplicate waste"
											value={formatNumber(
												rollup.duplicateCallWaste,
											)}
										/>
										<Stat
											label="Skills loaded"
											value={formatNumber(
												rollup.distinctSkillsLoaded,
											)}
											hint={`${formatNumber(
												rollup.skillLoadFailures,
											)} load failures`}
										/>
									</div>
								</section>

								{inference.available ? (
									<section>
										<h4 className="mb-2 font-medium text-sm">
											Model usage
										</h4>
										<div className="grid grid-cols-2 gap-2">
											<Stat
												label="LLM calls"
												value={formatNumber(
													inference.llmCalls,
												)}
											/>
											<Stat
												label="Avg latency"
												value={formatDuration(
													inference.avgResponseTimeMs,
												)}
												hint={`max ${formatDuration(
													inference.maxResponseTimeMs,
												)}`}
											/>
											<Stat
												label="Input tokens"
												value={formatNumber(
													inference.inputTokens,
												)}
												hint={`${formatNumber(
													inference.cacheReadTokens,
												)} cache reads`}
											/>
											<Stat
												label="Output tokens"
												value={formatNumber(
													inference.outputTokens,
												)}
												hint={`${formatNumber(
													inference.thinkingTokens,
												)} thinking`}
											/>
										</div>
									</section>
								) : null}

								{byTool.length > 0 ? (
									<section>
										<h4 className="mb-2 font-medium text-sm">
											By tool
										</h4>
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Tool</TableHead>
													<TableHead className="text-right">
														Calls
													</TableHead>
													<TableHead className="text-right">
														Failed
													</TableHead>
													<TableHead className="text-right">
														Avg
													</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{byTool.map(([name, tool]) => (
													<TableRow key={name}>
														<TableCell className="font-mono text-xs">
															{name}
														</TableCell>
														<TableCell className="text-right tabular-nums">
															{formatNumber(
																tool.calls,
															)}
														</TableCell>
														<TableCell className="text-right tabular-nums">
															{formatNumber(
																tool.failed,
															)}
														</TableCell>
														<TableCell className="text-right tabular-nums">
															{formatDuration(
																tool.avgDurationMs,
															)}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</section>
								) : null}

								<section>
									<h4 className="mb-2 font-medium text-sm">
										Runs
									</h4>
									<div className="space-y-2">
										{runs.map((run) => (
											<div
												key={run.runId}
												className="rounded-md border border-border bg-card p-3"
											>
												<div className="flex items-center gap-2">
													<span className="font-mono text-muted-foreground text-xs">
														{run.runId?.slice(0, 8)}
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
													<span className="ml-auto text-muted-foreground text-xs tabular-nums">
														{formatDuration(
															run.wallClockMs,
														)}
													</span>
												</div>

												{typeof run.score?.value ===
												"number" ? (
													<div className="mt-2">
														<div className="flex items-center justify-between text-xs">
															<span className="text-muted-foreground">
																Score
															</span>
															<span className="font-medium tabular-nums">
																{Math.round(
																	run.score
																		.value,
																)}
																/100
															</span>
														</div>
														<Progress
															value={
																run.score.value
															}
															className="mt-1 h-1.5"
														/>
													</div>
												) : run.score
														?.excludedReason ? (
													<div className="mt-2 text-muted-foreground text-xs">
														Not scored:{" "}
														{
															run.score
																.excludedReason
														}
													</div>
												) : null}

												<div className="mt-2 text-muted-foreground text-xs">
													{formatNumber(
														run.turns
															?.toolRoundTrips,
													)}{" "}
													tool calls ·{" "}
													{formatPercent(
														run.tools?.successRate,
													)}{" "}
													success
												</div>

												{run.outcome?.errorMessage ? (
													<div className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs">
														{
															run.outcome
																.errorMessage
														}
													</div>
												) : null}
											</div>
										))}
									</div>
								</section>
							</>
						) : null}
					</div>
				</ScrollArea>
			</div>
		);
	},
);
