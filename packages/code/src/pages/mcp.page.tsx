import { useState } from "react";
import { useNavigate } from "react-router";
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
import {
	ArrowLeftIcon,
	HammerIcon,
	PlusIcon,
	Settings2Icon,
} from "lucide-react";

/**
 * MCP (Model Context Protocol) tools management page
 *
 * @name MCPPage
 */
export const MCPPage = () => {
	const { t } = useTranslation(["code", "room", "common"]);
	const navigate = useNavigate();

	// Placeholder MCP tools data
	// In the future, this will come from backend via GetMCP or similar
	const [mcpTools] = useState<
		Array<{ id: string; name: string; type: string; description: string }>
	>([]);

	return (
		<div className="flex h-full flex-col bg-background text-foreground">
			{/* Header */}
			<div className="border-b border-border bg-card">
				<div className="flex items-center justify-between p-4">
					<div className="flex items-center gap-4">
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
							<HammerIcon className="h-5 w-5" />
							<h1 className="font-semibold text-xl">MCP Tools</h1>
						</div>
					</div>

					<Button disabled className="gap-2">
						<PlusIcon className="h-4 w-4" />
						Add MCP Tool
					</Button>
				</div>
			</div>

			{/* Content */}
			<ScrollArea className="flex-1">
				<div className="mx-auto max-w-4xl space-y-6 p-6">
					<div className="space-y-2">
						<h2 className="font-semibold text-lg">
							Model Context Protocol Tools
						</h2>
						<p className="text-muted-foreground text-sm">
							Configure MCP tools that extend the agent's capabilities. These
							tools can access external services, APIs, and data sources.
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
										<h3 className="font-semibold">No MCP Tools Configured</h3>
										<p className="text-muted-foreground text-sm">
											MCP tools will appear here once configured. Add tools to
											extend the agent's capabilities.
										</p>
									</div>
									<Button disabled>
										<PlusIcon className="mr-2 h-4 w-4" />
										Add Your First MCP Tool
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
												<CardTitle>{tool.name}</CardTitle>
												<CardDescription className="flex items-center gap-2">
													<span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs">
														{tool.type}
													</span>
												</CardDescription>
											</div>
											<Button variant="ghost" size="sm" disabled>
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
								About MCP Tools (Coming Soon)
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-muted-foreground text-sm">
							<p>
								Model Context Protocol (MCP) allows the agent to interact with
								external tools and services during execution.
							</p>
							<ul className="list-inside list-disc space-y-1">
								<li>
									<strong>Knowledge tools:</strong> Connect to vector databases,
									document stores, and knowledge bases
								</li>
								<li>
									<strong>Toolbox tools:</strong> Enable actions like web
									search, file operations, API calls
								</li>
								<li>
									<strong>Agent tools:</strong> Specialized capabilities for
									specific workflows
								</li>
							</ul>
							<p className="pt-2 text-xs">
								MCP tool configuration coming soon. Tools will be configurable
								per-room and workspace-inheritable.
							</p>
						</CardContent>
					</Card>

					<div className="flex items-center justify-center border-t border-border pt-6">
						<p className="text-center text-muted-foreground text-sm">
							MCP tool management interface under development
						</p>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
};
