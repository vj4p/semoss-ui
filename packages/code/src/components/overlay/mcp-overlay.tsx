import { BookOpenIcon, HammerIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";
import { type MCPConfig, MCPSelector } from "@semoss/shared";
import {
	Badge,
	Button,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";

export interface MCPOverlayProps {
	open: boolean;
	onDismiss: () => void;
	session: Session;
}

type Tab = "TOOLBOX" | "KNOWLEDGE";

/**
 * The `:mcp` overlay — manages MCP selection for the Code terminal.
 * Uses the same MCPSelector component as Playground to query engines/projects
 * tagged with "MCP" via MyEngines and MyProjects.
 */
export const MCPOverlay = ({ open, onDismiss, session }: MCPOverlayProps) => {
	const { t } = useTranslation("code");

	const [knowledge, setKnowledge] = useState<MCPConfig[]>([]);
	const [toolbox, setToolbox] = useState<MCPConfig[]>([]);
	const [activeTab, setActiveTab] = useState<Tab>("TOOLBOX");
	const [applying, setApplying] = useState(false);

	// Load current room's MCP selection on open
	const wasOpen = useRef(open);
	useEffect(() => {
		if (open && !wasOpen.current) {
			// TODO: Load current room's MCP configuration
			// For now, start with empty selection
			setKnowledge([]);
			setToolbox([]);
			setActiveTab("TOOLBOX");
		}
		wasOpen.current = open;
	}, [open]);

	const handleApply = async () => {
		setApplying(true);
		try {
			// Combine knowledge and toolbox selections
			const allMcps = [...knowledge, ...toolbox];

			// TODO: Save to session/room
			// await session.setMCPTools(allMcps.map(m => m.id));

			console.log("Selected MCPs:", allMcps);
			onDismiss();
		} catch (err) {
			console.error("Failed to apply MCP selection:", err);
		} finally {
			setApplying(false);
		}
	};

	return (
		<OverlayContainer
			open={open}
			onDismiss={() => !applying && onDismiss()}
			title=""
		>
			<DialogHeader>
				<DialogTitle>{t("mcp.title")}</DialogTitle>
				<DialogDescription>{t("mcp.description")}</DialogDescription>
			</DialogHeader>

			<Tabs
				value={activeTab}
				onValueChange={(v) => setActiveTab(v as Tab)}
				className="flex min-h-0 flex-1 flex-col gap-3"
			>
				<TabsList className="grid h-10 w-full grid-cols-2 p-1">
					<TabsTrigger value="TOOLBOX" className="h-full gap-2">
						<HammerIcon className="size-4" />
						Toolbox
						<Badge variant="outline" className="ms-1">
							{toolbox.length}
						</Badge>
					</TabsTrigger>
					<TabsTrigger value="KNOWLEDGE" className="h-full gap-2">
						<BookOpenIcon className="size-4" />
						Knowledge
						<Badge variant="outline" className="ms-1">
							{knowledge.length}
						</Badge>
					</TabsTrigger>
				</TabsList>

				<TabsContent
					value="TOOLBOX"
					className="flex min-h-0 flex-1 flex-col"
				>
					{activeTab === "TOOLBOX" && (
						<MCPSelector
							type="TOOLBOX"
							values={toolbox}
							onChange={setToolbox}
							autoFocus
							className="flex-1"
						/>
					)}
				</TabsContent>
				<TabsContent
					value="KNOWLEDGE"
					className="flex min-h-0 flex-1 flex-col"
				>
					{activeTab === "KNOWLEDGE" && (
						<MCPSelector
							type="KNOWLEDGE"
							values={knowledge}
							onChange={setKnowledge}
							autoFocus
							className="flex-1"
						/>
					)}
				</TabsContent>
			</Tabs>

			<DialogFooter>
				<Button
					variant="ghost"
					onClick={() => onDismiss()}
					disabled={applying}
				>
					Cancel
				</Button>
				<Button onClick={handleApply} disabled={applying}>
					{applying ? "Applying..." : "Apply"}
				</Button>
			</DialogFooter>
		</OverlayContainer>
	);
};
