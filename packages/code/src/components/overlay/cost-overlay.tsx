import { useEffect, useState } from "react";
import type { Session } from "@semoss/agent-core";
import { runPixel } from "@semoss/sdk";
import { Spinner } from "@semoss/ui/next";
import { type CostSummary, summarizeCost } from "./cost-summary";
import { OverlayContainer } from "./overlay-container";

export interface CostOverlayProps {
	open: boolean;
	onDismiss: () => void;
	session: Session | null;
}

/**
 * The `:cost` overlay — displays cost and usage breakdown for the current room.
 * Shows token counts, API calls, and estimated costs per model. Phase 4c.
 */
export const CostOverlay = ({ open, onDismiss, session }: CostOverlayProps) => {
	const [loading, setLoading] = useState(true);
	const [summary, setSummary] = useState<CostSummary | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open || !session) {
			return;
		}

		const fetchCostData = async () => {
			setLoading(true);
			try {
				const roomId = session.getState().roomId;
				if (!roomId) {
					// No room yet, so nothing has been used.
					setSummary(null);
					return;
				}
				const response = await runPixel<[unknown]>(
					`GetModelCost(roomId=[${JSON.stringify(roomId)}])`,
				);
				if (response.errors.length > 0) {
					throw new Error(response.errors[0]);
				}
				setSummary(summarizeCost(response.pixelReturn[0]?.output));
				setError(null);
			} catch (err) {
				setSummary(null);
				setError(
					err instanceof Error
						? err.message
						: "Could not load the usage",
				);
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

	/** A total from priced models alone is a minimum, so it says so; with none priced there is no total. */
	const totalCostLabel = (s: CostSummary) =>
		s.pricedCost === null
			? "No price"
			: s.complete
				? formatCost(s.pricedCost)
				: `${formatCost(s.pricedCost)}+`;

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":cost">
			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Spinner />
				</div>
			) : error ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono text-destructive text-sm">
						{error}
					</p>
					<p className="text-muted-foreground text-xs">
						Unable to load this room's usage
					</p>
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
					<div className="rounded-lg border bg-accent p-4">
						<h3 className="mb-3 font-mono font-semibold text-sm">
							Session Summary
						</h3>
						<div className="grid grid-cols-3 gap-4">
							<div>
								<p className="text-muted-foreground text-xs">
									Total Cost
								</p>
								<p className="font-mono font-semibold text-lg">
									{totalCostLabel(summary)}
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

					{summary.models.length > 0 && (
						<div className="space-y-2">
							<h3 className="font-mono font-semibold text-sm">
								By Model ({summary.models.length})
							</h3>
							<div className="space-y-2">
								{summary.models.map((model) => (
									<div
										key={model.name}
										className="flex flex-col gap-2 rounded border p-3"
									>
										<div className="flex items-center justify-between">
											<span className="font-medium font-mono text-sm">
												{model.name}
											</span>
											<span className="font-mono font-semibold">
												{model.cost === null
													? "No price"
													: formatCost(model.cost)}
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

					<div className="rounded border border-info bg-info-tint p-3">
						<p className="font-mono text-info text-xs">
							{summary.unpricedModels === 0 ? (
								<>
									<strong>Note:</strong> Costs are estimates
									based on published rates and may not reflect
									actual billing.
								</>
							) : (
								<>
									<strong>
										No price for {summary.unpricedModels} of{" "}
										{summary.models.length} models.
									</strong>{" "}
									{summary.pricedCost === null
										? "There is no published rate for the model this room used, so its cost is unknown, not zero."
										: "The total counts only the models that have one, so the room cost at least this much."}
								</>
							)}
						</p>
					</div>
				</div>
			)}
		</OverlayContainer>
	);
};
