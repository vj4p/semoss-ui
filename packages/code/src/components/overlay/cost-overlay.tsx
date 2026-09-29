import { useEffect, useState } from "react";
import type { Session } from "@semoss/agent-core";
import { runPixel } from "@semoss/sdk";
import { Spinner } from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";

export interface CostOverlayProps {
	open: boolean;
	onDismiss: () => void;
	session: Session | null;
}

interface CostBreakdown {
	model: string;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	estimatedCost: number;
	calls: number;
}

interface CostSummary {
	totalCost: number;
	totalTokens: number;
	totalCalls: number;
	byModel: CostBreakdown[];
}

/**
 * The `:cost` overlay — displays cost and usage breakdown for the current room.
 * Shows token counts, API calls, and estimated costs per model. Phase 4c.
 */
export const CostOverlay = ({ open, onDismiss, session }: CostOverlayProps) => {
	const [loading, setLoading] = useState(true);
	const [summary, setSummary] = useState<CostSummary | null>(null);

	useEffect(() => {
		if (!open || !session) {
			return;
		}

		const fetchCostData = async () => {
			setLoading(true);

			try {
				const state = session.getState();
				const roomId = state.roomId;

				if (!roomId) {
					// No room yet, show empty state
					setSummary({
						totalCost: 0,
						totalTokens: 0,
						totalCalls: 0,
						byModel: [],
					});
					setLoading(false);
					return;
				}

				// Call GetModelCost Pixel
				type CostResponse = {
					models: Array<{
						modelId: string;
						modelName: string;
						llmCalls: number;
						inputTokens: number;
						outputTokens: number;
						thinkingTokens: number;
						cacheReadTokens: number;
						cacheWriteTokens: number;
						cost: number | null;
						priced: boolean;
					}>;
					totals: {
						llmCalls: number;
						inputTokens: number;
						outputTokens: number;
						thinkingTokens: number;
						cacheReadTokens: number;
						cacheWriteTokens: number;
						cost: number | null;
						currency: string;
					};
					coverage: {
						pricedModels: number;
						unpricedModels: number;
						complete: boolean;
					};
				};

				const response = await runPixel<[CostResponse]>(
					`GetModelCost(roomId=["${roomId}"])`,
				);

				if (response.errors.length > 0) {
					console.error("GetModelCost error:", response.errors);
					setSummary({
						totalCost: 0,
						totalTokens: 0,
						totalCalls: 0,
						byModel: [],
					});
					setLoading(false);
					return;
				}

				const data = response.pixelReturn[0]?.output;
				if (!data) {
					setSummary({
						totalCost: 0,
						totalTokens: 0,
						totalCalls: 0,
						byModel: [],
					});
					setLoading(false);
					return;
				}

				// Map backend response to CostSummary
				const costSummary: CostSummary = {
					totalCost: data.totals.cost ?? 0,
					totalTokens:
						data.totals.inputTokens + data.totals.outputTokens,
					totalCalls: data.totals.llmCalls,
					byModel: data.models.map((m) => ({
						model: m.modelName || m.modelId,
						inputTokens: m.inputTokens,
						outputTokens: m.outputTokens,
						totalTokens: m.inputTokens + m.outputTokens,
						estimatedCost: m.cost ?? 0,
						calls: m.llmCalls,
					})),
				};

				setSummary(costSummary);
			} catch (error) {
				console.error("Failed to fetch cost data:", error);
				setSummary({
					totalCost: 0,
					totalTokens: 0,
					totalCalls: 0,
					byModel: [],
				});
			} finally {
				setLoading(false);
			}
		};

		fetchCostData();
	}, [open, session]);

	const formatCost = (cost: number) => {
		if (cost === 0) return "$0.00";
		if (cost < 0.01) return `$${cost.toFixed(4)}`;
		return `$${cost.toFixed(2)}`;
	};

	const formatTokens = (tokens: number) => {
		if (tokens >= 1_000_000) {
			return `${(tokens / 1_000_000).toFixed(2)}M`;
		}
		if (tokens >= 1_000) {
			return `${(tokens / 1_000).toFixed(1)}K`;
		}
		return tokens.toString();
	};

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":cost">
			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Spinner />
				</div>
			) : !summary || summary.totalCalls === 0 ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono text-muted-foreground text-sm">
						No usage data yet
					</p>
					<p className="text-muted-foreground text-xs">
						Cost tracking will appear after your first model
						interaction
					</p>
				</div>
			) : (
				<div className="space-y-6">
					{/* Summary card */}
					<div className="rounded-lg border bg-accent/10 p-4">
						<h3 className="mb-3 font-mono font-semibold text-sm">
							Session Summary
						</h3>
						<div className="grid grid-cols-3 gap-4">
							<div>
								<p className="text-muted-foreground text-xs">
									Total Cost
								</p>
								<p className="font-mono font-semibold text-lg">
									{formatCost(summary.totalCost)}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground text-xs">
									Total Tokens
								</p>
								<p className="font-mono font-semibold text-lg">
									{formatTokens(summary.totalTokens)}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground text-xs">
									API Calls
								</p>
								<p className="font-mono font-semibold text-lg">
									{summary.totalCalls}
								</p>
							</div>
						</div>
					</div>

					{/* Per-model breakdown */}
					{summary.byModel.length > 0 && (
						<div className="space-y-2">
							<h3 className="font-mono font-semibold text-sm">
								By Model ({summary.byModel.length})
							</h3>
							<div className="space-y-2">
								{summary.byModel.map((model) => (
									<div
										key={model.model}
										className="flex flex-col gap-2 rounded border p-3"
									>
										<div className="flex items-center justify-between">
											<span className="font-medium font-mono text-sm">
												{model.model}
											</span>
											<span className="font-mono font-semibold">
												{formatCost(
													model.estimatedCost,
												)}
											</span>
										</div>
										<div className="grid grid-cols-4 gap-2 font-mono text-muted-foreground text-xs">
											<div>
												<span className="block">
													Input
												</span>
												<span className="font-medium text-foreground">
													{formatTokens(
														model.inputTokens,
													)}
												</span>
											</div>
											<div>
												<span className="block">
													Output
												</span>
												<span className="font-medium text-foreground">
													{formatTokens(
														model.outputTokens,
													)}
												</span>
											</div>
											<div>
												<span className="block">
													Total
												</span>
												<span className="font-medium text-foreground">
													{formatTokens(
														model.totalTokens,
													)}
												</span>
											</div>
											<div>
												<span className="block">
													Calls
												</span>
												<span className="font-medium text-foreground">
													{model.calls}
												</span>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Info note */}
					<div className="rounded border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
						<p className="font-mono text-blue-900 text-xs dark:text-blue-100">
							<strong>Note:</strong> Costs are estimates based on
							published rates and may not reflect actual billing.
						</p>
					</div>
				</div>
			)}
		</OverlayContainer>
	);
};
