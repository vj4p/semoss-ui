import { CheckIcon, HammerIcon, Loader2Icon, XCircleIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "@semoss/i18n";
import { Badge, cn, ScrollArea, useIsMobile } from "@semoss/ui/next";
import type { RoomStore, ToolStore } from "@/stores";
import { isAskExecutionMode } from "@/utility/mcp-utils";

interface RoomActivityProps {
	/** Room whose tool calls are indexed. */
	room: RoomStore;
}

const STATUS_ICON: Record<ToolStore["status"], React.ReactNode> = {
	SUCCESS: <CheckIcon className="size-3.5 text-success" />,
	ERROR: <XCircleIcon className="size-3.5 text-destructive" />,
	CANCELLED: <XCircleIcon className="size-3.5 text-muted-foreground" />,
	LOADING: <Loader2Icon className="size-3.5 animate-spin text-primary" />,
	INITIAL: <HammerIcon className="size-3.5 text-muted-foreground" />,
};

/**
 * Every tool call in this room, in one scannable list.
 *
 * The thread already shows each call in full — its own card, its inputs, its
 * output — which is exactly what makes it slow to scan on a long run: finding
 * "did it already touch that file" means scrolling past a lot of expanded
 * detail. This is the same calls reduced to one line each (status icon, name),
 * so the shape of a run reads at a glance. Clicking a row opens that call the
 * same way clicking it in the thread would — this list holds no state of its
 * own.
 *
 * `room.tools` is already call order (see the getter) — nothing here needs
 * to re-derive it from the message tree.
 */
export const RoomActivity: React.FC<RoomActivityProps> = observer(
	({ room }) => {
		const { t } = useTranslation("room");
		const isMobile = useIsMobile();

		const tools = room.tools.filter((tool) => tool.display !== "hidden");

		return (
			<div className="flex h-full flex-col">
				<div className="flex items-center gap-2 border-border border-b px-3 py-2">
					<span className="font-semibold text-sm">
						{t("activity.title")}
					</span>
					{tools.length > 0 ? (
						<Badge variant="secondary">{tools.length}</Badge>
					) : null}
				</div>

				<ScrollArea className="flex-1">
					<div className="flex flex-col gap-0.5 p-2">
						{tools.length === 0 ? (
							<p className="py-8 text-center text-muted-foreground text-sm">
								{t("activity.empty")}
							</p>
						) : (
							tools.map((tool) => {
								const needsApproval =
									tool.isResolved &&
									tool.status === "INITIAL" &&
									isAskExecutionMode(
										tool.json._meta?.SMSS_MCP_EXECUTION,
									);
								return (
									<button
										key={tool.id}
										type="button"
										onClick={() =>
											tool.openTool(
												isMobile ? "inline" : undefined,
											)
										}
										className={cn(
											"flex items-center gap-2 rounded-md px-2 py-1.5 text-start hover:bg-accent",
											tool.isOpen && "bg-accent",
										)}
									>
										<span className="shrink-0">
											{STATUS_ICON[tool.status]}
										</span>
										<span
											className={cn(
												"min-w-0 flex-1 truncate font-mono text-xs",
												needsApproval && "text-warning",
											)}
										>
											{tool.displayName}
										</span>
									</button>
								);
							})
						)}
					</div>
				</ScrollArea>
			</div>
		);
	},
);
