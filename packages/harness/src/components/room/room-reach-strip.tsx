import {
	CpuIcon,
	FolderIcon,
	GitBranchIcon,
	PlugIcon,
	RefreshCwIcon,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@semoss/i18n";
import { useInsight } from "@semoss/sdk/react";
import { Badge, cn } from "@semoss/ui/next";
import { useRoomPacks } from "@/hooks";
import type { RoomStore } from "@/stores";
import { type CostOutput, formatCost } from "@/utility";

interface RoomReachStripProps {
	/** Room whose reach — project, model, and attached packs — is summarized. */
	room: RoomStore;
}

/** `ProjectGitStatus` output, narrowed to the two facts this strip shows. */
interface GitStatusOutput {
	branch?: string;
	staged?: unknown[];
	unstaged?: unknown[];
}

/**
 * What the agent can touch, and what it has done, always visible above the
 * composer.
 *
 * Two things this replaces having to look for. **Reach** — project, model,
 * attached packs — already existed somewhere in the harness (behind the "+" menu
 * and the Capabilities panel), but never at the same time as the place you are
 * about to send a message from; the question "what is it allowed to do" had no
 * answer on screen. **Run status** — cost and git changes — is read fresh each
 * time this mounts rather than polled, deliberately: both come from real Pixel
 * calls (`GetModelCost`, `ProjectGitStatus`), and a always-on poll would multiply
 * that cost by every open room. The refresh icon is the escape hatch for "show me
 * now" without paying for it continuously.
 *
 * Read-only by design. Every affordance here opens the Capabilities panel rather
 * than mutating anything directly — this is a summary, not a second place to edit
 * the same state `RoomCapabilities` owns.
 */
export const RoomReachStrip: React.FC<RoomReachStripProps> = observer(
	({ room }) => {
		const { t } = useTranslation("room");
		const insight = useInsight();
		const { packs } = useRoomPacks();

		const [cost, setCost] = useState<CostOutput | null>(null);
		const [gitStatus, setGitStatus] = useState<GitStatusOutput | null>(
			null,
		);
		const [refreshing, setRefreshing] = useState(false);

		const projectId = room.options.project?.project_id;

		const refreshStatus = useCallback(async () => {
			setRefreshing(true);
			try {
				const calls = [
					`GetModelCost(roomId=${JSON.stringify(room.roomId)});`,
				];
				if (projectId) {
					calls.push(
						`ProjectGitStatus(project=${JSON.stringify(projectId)});`,
					);
				}
				const { pixelReturn } = await insight.actions.run<
					[CostOutput, GitStatusOutput]
				>(calls.join(""));
				const costReturn = pixelReturn[0];
				const costFailed =
					!costReturn ||
					costReturn.operationType.indexOf("ERROR") > -1;
				setCost(costFailed ? null : (costReturn.output as CostOutput));
				if (projectId) {
					const statusReturn = pixelReturn[1];
					setGitStatus(
						(statusReturn?.output as GitStatusOutput) ?? null,
					);
				} else {
					setGitStatus(null);
				}
			} catch (e) {
				console.error("Could not read run status", e);
			} finally {
				setRefreshing(false);
			}
		}, [insight, projectId, room.roomId]);

		// `refreshStatus` is memoized on room/project/insight, so keying the effect
		// on the function itself re-fetches only when one of those actually
		// changes — not on every re-render a streaming run causes, which would
		// multiply GetModelCost calls for no benefit the user asked for.
		useEffect(() => {
			void refreshStatus();
		}, [refreshStatus]);

		const enabledIds = new Set(room.packs);
		const enabled = packs.filter((pack) => enabledIds.has(pack.id));
		const toolCount = enabled.reduce(
			(sum, pack) => sum + pack.toolCount,
			0,
		);
		const askCount = enabled.reduce((sum, pack) => sum + pack.askCount, 0);

		const openCapabilities = () => {
			room.addSidebarNode("room-capabilities", {
				type: "tab",
				name: "Capabilities",
				component: "room-capabilities",
				config: {},
				enableClose: true,
			});
		};

		const openChanges = () => {
			room.addSidebarNode("room-changes", {
				type: "tab",
				name: "Changes",
				component: "room-changes",
				config: {},
				enableClose: true,
			});
		};

		const projectName =
			room.options.project?.project_name ??
			room.options.project?.project_id;

		const dirtyCount =
			(gitStatus?.staged?.length ?? 0) +
			(gitStatus?.unstaged?.length ?? 0);
		const costValue = cost?.totals?.cost;
		const hasCost = typeof costValue === "number";

		return (
			<div className="mb-2 flex flex-wrap items-center gap-1.5">
				<span className="text-muted-foreground text-xs uppercase tracking-wide">
					{t("reach.label")}
				</span>
				<span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />

				{projectName ? (
					<Badge variant="outline" className="gap-1 font-normal">
						<FolderIcon className="size-3" />
						{projectName}
					</Badge>
				) : null}

				{room.model ? (
					<Badge variant="outline" className="gap-1 font-normal">
						<CpuIcon className="size-3" />
						{room.model.engine_display_name ??
							room.model.engine_name}
					</Badge>
				) : null}

				{enabled.length > 0 ? (
					<span
						className="mx-1 h-4 w-px bg-border"
						aria-hidden="true"
					/>
				) : null}

				{enabled.map((pack) => (
					<button
						key={pack.id}
						type="button"
						onClick={openCapabilities}
						className={cn(
							"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
							"border-border bg-card hover:bg-accent",
						)}
					>
						{pack.label}
						<span className="text-muted-foreground text-xs">
							{pack.toolCount}
						</span>
					</button>
				))}

				<button
					type="button"
					onClick={openCapabilities}
					className="inline-flex items-center gap-1 rounded-full border border-border border-dashed px-2 py-0.5 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
				>
					<PlugIcon className="size-3" />
					{t("reach.addPack")}
				</button>

				<span
					className="mx-1 ml-auto h-4 w-px bg-border"
					aria-hidden="true"
				/>

				{gitStatus?.branch ? (
					<button
						type="button"
						onClick={openChanges}
						className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs hover:bg-accent"
					>
						<GitBranchIcon className="size-3" />
						<span className="font-mono">{gitStatus.branch}</span>
						{dirtyCount > 0 ? (
							<span className="text-muted-foreground">
								{t("reach.dirtyFiles", { count: dirtyCount })}
							</span>
						) : null}
					</button>
				) : null}

				{hasCost ? (
					<span className="text-muted-foreground text-xs">
						{formatCost(
							costValue as number,
							cost?.totals?.currency,
						)}
					</span>
				) : null}

				{toolCount > 0 ? (
					<span className="text-muted-foreground text-xs">
						{t("reach.toolSummary", { count: toolCount })}
						{askCount > 0 ? (
							<>
								{" · "}
								<span className="text-warning">
									{t("reach.askSummary", { count: askCount })}
								</span>
							</>
						) : null}
					</span>
				) : null}

				<button
					type="button"
					disabled={refreshing}
					onClick={() => void refreshStatus()}
					aria-label={t("reach.refresh")}
					className="text-muted-foreground hover:text-foreground disabled:opacity-50"
				>
					<RefreshCwIcon
						className={cn("size-3", refreshing && "animate-spin")}
					/>
				</button>
			</div>
		);
	},
);
