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
import { getRoomOptions, type RoomMcpEntry, updateRoomOptions } from "@/api";
import { OverlayContainer } from "./overlay-container";

export interface MCPOverlayProps {
	open: boolean;
	onDismiss: () => void;
	session: Session;
	insightId?: string;
	roomId?: string;
}

type Tab = "TOOLBOX" | "KNOWLEDGE";

/** The catalog types `MCPConfig` accepts. Mirrors `MCP["type"]` in `@semoss/shared`. */
const MCP_TYPES = new Set<MCPConfig["type"]>([
	"PROJECT",
	"STORAGE",
	"DATABASE",
	"FUNCTION",
	"MODEL",
	"VECTOR",
	"GUARDRAIL",
	"ROOM",
]);

/**
 * Narrow a room-persisted MCP entry (whose `type` is a loose string, since it
 * round-trips through JSON) into the strict `MCPConfig` the selector expects.
 * An entry with an unrecognized type cannot be rendered by icon, so it is
 * dropped rather than mis-typed.
 */
const toMCPConfig = (entry: RoomMcpEntry): MCPConfig | undefined => {
	if (!MCP_TYPES.has(entry.type as MCPConfig["type"])) {
		return undefined;
	}
	return {
		type: entry.type as MCPConfig["type"],
		id: entry.id,
		name: entry.name,
		fromRoom: entry.fromRoom,
		fromWorkspace: entry.fromWorkspace,
	};
};

/** The reverse of {@link toMCPConfig}, for writing the selection back. */
const toRoomMcpEntry = (config: MCPConfig): RoomMcpEntry => ({
	id: config.id,
	name: config.name,
	type: config.type,
	fromRoom: config.fromRoom,
	fromWorkspace: config.fromWorkspace,
});

/**
 * Split MCP configs by type
 */
const splitMcpByType = (mcps: RoomMcpEntry[]) => {
	const knowledge: MCPConfig[] = [];
	const toolbox: MCPConfig[] = [];

	for (const mcp of mcps) {
		const config = toMCPConfig(mcp);
		if (config === undefined) {
			continue;
		}
		if (config.type === "VECTOR") {
			knowledge.push(config);
		} else {
			toolbox.push(config);
		}
	}

	return { knowledge, toolbox };
};

/**
 * The `:mcp` overlay — manages MCP selection for the Code terminal.
 * Uses the same MCPSelector component as Playground to query engines/projects
 * tagged with "MCP" via MyEngines and MyProjects.
 */
export const MCPOverlay = ({
	open,
	onDismiss,
	session,
	insightId,
	roomId: roomIdProp,
}: MCPOverlayProps) => {
	const { t } = useTranslation("code");

	const [knowledge, setKnowledge] = useState<MCPConfig[]>([]);
	const [toolbox, setToolbox] = useState<MCPConfig[]>([]);
	const [activeTab, setActiveTab] = useState<Tab>("TOOLBOX");
	const [applying, setApplying] = useState(false);
	const [loading, setLoading] = useState(false);

	// Load current room's MCP selection on open
	const wasOpen = useRef(open);
	useEffect(() => {
		if (open && !wasOpen.current) {
			const loadRoomMCPs = async () => {
				const roomId = roomIdProp ?? session.getState().roomId;
				if (!roomId || !insightId) {
					// New room, start empty
					setKnowledge([]);
					setToolbox([]);
					setActiveTab("TOOLBOX");
					return;
				}

				try {
					setLoading(true);
					// Use proper API wrapper that handles response parsing
					const roomOptions = await getRoomOptions(insightId, roomId);
					const mcps = roomOptions.mcp ?? [];

					const { knowledge: k, toolbox: t } = splitMcpByType(mcps);

					setKnowledge(k);
					setToolbox(t);
					setActiveTab("TOOLBOX");
				} catch (err) {
					console.error("Failed to load room MCPs:", err);
					setKnowledge([]);
					setToolbox([]);
					setActiveTab("TOOLBOX");
				} finally {
					setLoading(false);
				}
			};

			loadRoomMCPs();
		}
		wasOpen.current = open;
	}, [open, session, insightId, roomIdProp]);

	const handleApply = async () => {
		const roomId = roomIdProp ?? session.getState().roomId;
		if (!roomId || !insightId) {
			console.warn(
				"No room ID or insight ID - cannot save MCP selection",
			);
			onDismiss();
			return;
		}

		setApplying(true);
		try {
			// Get current options first
			const currentOptions = await getRoomOptions(insightId, roomId);

			// Combine knowledge and toolbox selections
			const allMcps = [...knowledge, ...toolbox].map(toRoomMcpEntry);

			// Update room options with new MCP selection
			await updateRoomOptions(insightId, roomId, {
				...currentOptions,
				mcp: allMcps,
			});

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
			onDismiss={() => !applying && !loading && onDismiss()}
			title=""
		>
			<DialogHeader>
				<DialogTitle>{t("mcp.title")}</DialogTitle>
				<DialogDescription>{t("mcp.description")}</DialogDescription>
			</DialogHeader>

			{loading ? (
				<div className="flex flex-1 items-center justify-center">
					<div className="text-muted-foreground text-sm">
						Loading MCP configuration...
					</div>
				</div>
			) : (
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
			)}

			<DialogFooter>
				<Button
					variant="ghost"
					onClick={() => onDismiss()}
					disabled={applying || loading}
				>
					Cancel
				</Button>
				<Button onClick={handleApply} disabled={applying || loading}>
					{applying ? "Applying..." : "Apply"}
				</Button>
			</DialogFooter>
		</OverlayContainer>
	);
};
