import { useNavigate } from "react-router";
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
import { ArrowLeftIcon, BotIcon, CheckCircle2Icon } from "lucide-react";

/**
 * Agents management page for viewing and selecting agent harnesses
 *
 * @name AgentsPage
 */
export const AgentsPage = () => {
	const { t } = useTranslation(["code", "room", "common"]);
	const navigate = useNavigate();
	const { harnesses } = useAgentHarnesses({ fallback: [] });

	// Get current harness from localStorage
	const savedSettings = localStorage.getItem("code-settings");
	let currentHarness = "claude_code";
	if (savedSettings) {
		try {
			const settings = JSON.parse(savedSettings);
			currentHarness = settings.harnessType || "claude_code";
		} catch (e) {
			// ignore
		}
	}

	const handleSelectHarness = (harnessName: string) => {
		const settings = savedSettings ? JSON.parse(savedSettings) : {};
		settings.harnessType = harnessName;
		localStorage.setItem("code-settings", JSON.stringify(settings));

		console.log("Selected harness:", harnessName);
		// Optionally navigate back
		// navigate("/");
	};

	return (
		<div className="flex h-full flex-col bg-background text-foreground">
			{/* Header */}
			<div className="border-b border-border bg-card">
				<div className="flex items-center gap-4 p-4">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate("/")}
						className="gap-2"
					>
						<ArrowLeftIcon className="h-4 w-4" />
						Back to Console
					</Button>
					<div className="flex items-center gap-2">
						<BotIcon className="h-5 w-5" />
						<h1 className="font-semibold text-xl">Agent Harnesses</h1>
					</div>
				</div>
			</div>

			{/* Content */}
			<ScrollArea className="flex-1">
				<div className="mx-auto max-w-4xl space-y-6 p-6">
					<div className="space-y-2">
						<h2 className="font-semibold text-lg">Available Harnesses</h2>
						<p className="text-muted-foreground text-sm">
							Choose an agent harness type. Each harness provides different
							capabilities and tool access patterns.
						</p>
					</div>

					{harnesses.length === 0 ? (
						<Card>
							<CardContent className="flex min-h-[200px] items-center justify-center text-center">
								<div className="space-y-2">
									<p className="text-muted-foreground">
										No agent harnesses available
									</p>
									<p className="text-muted-foreground text-sm">
										Configure harnesses via the backend GetAgentHarnesses
										endpoint
									</p>
								</div>
							</CardContent>
						</Card>
					) : (
						<div className="grid gap-4 md:grid-cols-2">
							{harnesses.map((harness) => {
								const isSelected = harness.name === currentHarness;

								return (
									<Card
										key={harness.name}
										className={
											isSelected
												? "border-primary bg-primary/5 dark:bg-primary/10"
												: "cursor-pointer hover:border-primary/50"
										}
										onClick={() => handleSelectHarness(harness.name)}
									>
										<CardHeader>
											<div className="flex items-start justify-between">
												<div className="space-y-1">
													<CardTitle className="flex items-center gap-2">
														{harness.label || harness.name}
														{isSelected && (
															<CheckCircle2Icon className="h-4 w-4 text-primary" />
														)}
													</CardTitle>
													<CardDescription className="font-mono text-xs">
														{harness.name}
													</CardDescription>
												</div>
											</div>
										</CardHeader>
										<CardContent>
											<p className="text-muted-foreground text-sm">
												{harness.description ||
													"Agent harness for running Claude Code operations"}
											</p>

											{isSelected && (
												<div className="mt-4">
													<Button size="sm" variant="outline" className="w-full">
														Currently Selected
													</Button>
												</div>
											)}
										</CardContent>
									</Card>
								);
							})}
						</div>
					)}

					<Card className="border-muted-foreground/20 bg-muted/50">
						<CardHeader>
							<CardTitle className="text-base">About Agent Harnesses</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-muted-foreground text-sm">
							<p>
								Agent harnesses determine how the terminal executes operations
								and which tools are available.
							</p>
							<ul className="list-inside list-disc space-y-1">
								<li>
									<strong>claude_code:</strong> Standard Claude Code harness
									with full tool access
								</li>
								<li>
									<strong>flex:</strong> Flexible harness with customizable
									behaviors
								</li>
								<li>
									Settings apply to new sessions and can be changed anytime
								</li>
							</ul>
						</CardContent>
					</Card>
				</div>
			</ScrollArea>
		</div>
	);
};
