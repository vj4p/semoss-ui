import { useEffect, useState } from "react";
import type { CapabilityPack } from "@semoss/agent-core";
import { readCapabilityPacks } from "@semoss/agent-core";
import { runPixel } from "@semoss/sdk";
import { Spinner } from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";

export interface PacksOverlayProps {
	open: boolean;
	onDismiss: () => void;
}

/**
 * The `:packs` overlay — displays capability packs available in the platform.
 * Shows pack name, description, tool counts, and engine requirements. Phase 4b.
 */
export const PacksOverlay = ({ open, onDismiss }: PacksOverlayProps) => {
	const [loading, setLoading] = useState(true);
	const [packs, setPacks] = useState<CapabilityPack[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}

		const loadPacks = async () => {
			setLoading(true);
			setError(null);

			try {
				// Create a minimal PixelRunner from the SDK's env
				const runner = {
					actions: {
						run: async (pixel: string) => {
							const result = await runPixel(pixel);
							return { pixelReturn: [{ output: result }] };
						},
					},
				};

				const loadedPacks = await readCapabilityPacks(
					runner,
					(message, err) => {
						console.warn("Pack read error:", message, err);
					},
				);

				setPacks(loadedPacks);
			} catch (err) {
				console.error("Failed to load packs:", err);
				setError(
					err instanceof Error
						? err.message
						: "Failed to load capability packs",
				);
			} finally {
				setLoading(false);
			}
		};

		loadPacks();
	}, [open]);

	const getEngineIcon = (requirement: string) => {
		switch (requirement) {
			case "DATABASE":
				return "🗄️";
			case "VECTOR":
				return "🔍";
			case "MODEL":
				return "🤖";
			case "STORAGE":
				return "💾";
			default:
				return "📦";
		}
	};

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":packs">
			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Spinner />
				</div>
			) : error ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono text-red-600 text-sm dark:text-red-400">
						{error}
					</p>
					<p className="text-muted-foreground text-xs">
						Unable to load capability packs
					</p>
				</div>
			) : packs.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono text-muted-foreground text-sm">
						No capability packs available
					</p>
					<p className="text-muted-foreground text-xs">
						Packs may be disabled or not yet configured
					</p>
				</div>
			) : (
				<div className="space-y-1">
					<p className="mb-4 font-mono text-muted-foreground text-sm">
						Available capability packs ({packs.length} total)
					</p>
					<div className="space-y-3">
						{packs.map((pack) => (
							<div
								key={pack.id}
								className="flex flex-col gap-2 rounded border p-4 hover:bg-accent/50"
							>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<h3 className="font-mono font-semibold text-base">
												{pack.label}
											</h3>
											{pack.requires &&
												pack.requires.length > 0 && (
													<div className="flex gap-1">
														{pack.requires.map(
															(req) => (
																<span
																	key={req}
																	title={req}
																	className="text-base"
																>
																	{getEngineIcon(
																		req,
																	)}
																</span>
															),
														)}
													</div>
												)}
										</div>
										<p className="mt-1 text-muted-foreground text-sm">
											{pack.description}
										</p>
									</div>
								</div>
								<div className="flex gap-4 font-mono text-muted-foreground text-xs">
									<span>
										{pack.toolCount} tool
										{pack.toolCount !== 1 ? "s" : ""}
									</span>
									{pack.askCount > 0 && (
										<span className="text-yellow-600 dark:text-yellow-400">
											{pack.askCount} require
											{pack.askCount !== 1 ? "" : "s"}{" "}
											approval
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</OverlayContainer>
	);
};
