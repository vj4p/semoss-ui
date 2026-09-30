import { HammerIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { useState } from "react";
import type { Session } from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";
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

interface MCPOverlayProps {
	open: boolean;
	onDismiss: () => void;
	session: Session;
}

/**
 * MCP overlay for managing Model Context Protocol tools
 *
 * Displays available MCP tools and allows configuration,
 * similar to how Claude Code presents MCP tool management.
 */
export const MCPOverlay = ({ open, onDismiss, session }: MCPOverlayProps) => {
	const { t } = useTranslation(["code", "common"]);

	// Placeholder MCP tools data
	// In the future, this will come from session state or backend
	const [mcpTools] = useState<
		Array<{ id: string; name: string; type: string; description: string }>
	>([]);

	return (
		<OverlayContainer
			open={open}
			onDismiss={onDismiss}
			title={t("mcp.title")}
		>
			<ScrollArea className="h-full">
				<div className="space-y-6 p-6">
					<div className="space-y-2">
						<p className="text-muted-foreground text-sm">
							{t("mcp.description")}
						</p>
					</div>

					{mcpTools.length === 0 ? (
						<Card>
							<CardContent className="flex min-h-[300px] flex-col items-center justify-center text-center">
								<div className="space-y-4">
									<div className="flex justify-center">
										<div className="rounded-full bg-muted p-4">
											<HammerIcon className="h-8 w-8 text-muted-foreground" />
										</div>
									</div>
									<div className="space-y-2">
										<h3 className="font-semibold">
											{t("mcp.noTools")}
										</h3>
										<p className="text-muted-foreground text-sm">
											{t("mcp.noToolsDescription")}
										</p>
									</div>
									<Button disabled>
										<PlusIcon className="mr-2 h-4 w-4" />
										{t("mcp.addTool")}
									</Button>
								</div>
							</CardContent>
						</Card>
					) : (
						<div className="space-y-4">
							{mcpTools.map((tool) => (
								<Card key={tool.id}>
									<CardHeader>
										<div className="flex items-start justify-between">
											<div className="space-y-1">
												<CardTitle className="text-base">
													{tool.name}
												</CardTitle>
												<CardDescription className="flex items-center gap-2">
													<span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs">
														{tool.type}
													</span>
												</CardDescription>
											</div>
											<Button
												variant="ghost"
												size="sm"
												disabled
											>
												<Settings2Icon className="h-4 w-4" />
											</Button>
										</div>
									</CardHeader>
									<CardContent>
										<p className="text-muted-foreground text-sm">
											{tool.description}
										</p>
									</CardContent>
								</Card>
							))}
						</div>
					)}

					<Card className="border-muted-foreground/20 bg-muted/50">
						<CardHeader>
							<CardTitle className="text-base">
								{t("mcp.aboutTitle")}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-muted-foreground text-sm">
							<p>{t("mcp.aboutDescription")}</p>
							<ul className="list-inside list-disc space-y-1">
								<li>
									<strong>{t("mcp.knowledgeTools")}</strong>{" "}
									{t("mcp.knowledgeDescription")}
								</li>
								<li>
									<strong>{t("mcp.toolboxTools")}</strong>{" "}
									{t("mcp.toolboxDescription")}
								</li>
								<li>
									<strong>{t("mcp.agentTools")}</strong>{" "}
									{t("mcp.agentDescription")}
								</li>
							</ul>
							<p className="pt-2 text-xs">
								{t("mcp.comingSoon")}
							</p>
						</CardContent>
					</Card>
				</div>
			</ScrollArea>
		</OverlayContainer>
	);
};
