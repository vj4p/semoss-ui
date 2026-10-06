import { BotIcon, CheckIcon } from "lucide-react";
import { useState } from "react";
import type { Session } from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";
import { useAgentHarnesses } from "@semoss/shared";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	ScrollArea,
} from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";

interface AgentOverlayProps {
	open: boolean;
	onDismiss: () => void;
	session: Session;
}

/**
 * Agent overlay for selecting agent harness
 *
 * Displays available agent harnesses in a card-based UI,
 * similar to how Claude Code presents agent selection.
 */
export const AgentOverlay = ({
	open,
	onDismiss,
	session,
}: AgentOverlayProps) => {
	const { t } = useTranslation(["code", "common"]);
	const { harnesses } = useAgentHarnesses({ fallback: [] });
	const [selectedHarness, setSelectedHarness] = useState<string>(
		() => session.getState().harness ?? "",
	);

	const handleSelect = async (harnessName: string) => {
		setSelectedHarness(harnessName);
		await session.setHarness(harnessName);
	};

	const handleApply = () => {
		onDismiss();
	};

	return (
		<OverlayContainer
			open={open}
			onDismiss={onDismiss}
			title={t("agent.title")}
		>
			<ScrollArea className="h-full">
				<div className="space-y-6 p-6">
					<div className="space-y-2">
						<p className="text-muted-foreground text-sm">
							{t("agent.description")}
						</p>
					</div>

					{harnesses.length === 0 ? (
						<Card>
							<CardContent className="flex min-h-[200px] flex-col items-center justify-center text-center">
								<div className="space-y-4">
									<div className="flex justify-center">
										<div className="rounded-full bg-muted p-4">
											<BotIcon className="h-8 w-8 text-muted-foreground" />
										</div>
									</div>
									<div className="space-y-2">
										<h3 className="font-semibold">
											{t("agent.noHarnesses")}
										</h3>
										<p className="text-muted-foreground text-sm">
											{t("agent.noHarnessesDescription")}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					) : (
						<div className="grid gap-4 md:grid-cols-2">
							{harnesses.map((harness) => {
								const isSelected =
									harness.name === selectedHarness;

								return (
									<Card
										key={harness.name}
										className={`cursor-pointer transition-all hover:border-primary ${
											isSelected
												? "border-primary bg-accent"
												: "border-border"
										}`}
										onClick={() =>
											handleSelect(harness.name)
										}
									>
										<CardHeader>
											<div className="flex items-start justify-between">
												<div className="space-y-1">
													<CardTitle className="text-base">
														{harness.label ||
															harness.name}
													</CardTitle>
													{harness.description && (
														<CardDescription className="text-xs">
															{
																harness.description
															}
														</CardDescription>
													)}
												</div>
												{isSelected && (
													<CheckIcon className="h-5 w-5 text-primary" />
												)}
											</div>
										</CardHeader>
									</Card>
								);
							})}
						</div>
					)}

					<div className="rounded-lg border border-muted-foreground/20 bg-muted/50 p-4">
						<div className="space-y-2 text-sm">
							<p className="font-medium">
								{t("agent.aboutHarnesses")}
							</p>
							<p className="text-muted-foreground">
								{t("agent.aboutDescription")}
							</p>
						</div>
					</div>

					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onDismiss}>
							{t("common:cancel")}
						</Button>
						<Button onClick={handleApply}>
							{t("common:done")}
						</Button>
					</div>
				</div>
			</ScrollArea>
		</OverlayContainer>
	);
};
