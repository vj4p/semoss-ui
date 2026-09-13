import { InboxIcon, RefreshCw } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "@semoss/i18n";
import { useInsight, usePixel } from "@semoss/sdk/react";
import { Badge, Button, cn, Skeleton, toast } from "@semoss/ui/next";
import type { RoomItem } from "@/components";
import { useGlobalBreadcrumbs } from "@/hooks";
import { type CostOutput, formatCost } from "@/utility";

/** One row from GetPendingAgentActions. */
interface PendingAction {
	actionId?: string;
	runId?: string;
	roomId?: string;
	toolName?: string;
	toolArgs?: unknown;
	hasUi?: boolean | string;
	uiUrl?: string | null;
	dateCreated?: string;
}

/** One row from GetAgentRunsForRoom — see AgentRunStore's column mapping. */
interface RecentRun {
	runId?: string;
	roomId?: string;
	status?: string;
	input?: string;
	startedAt?: string | number | null;
	dateCreated?: string | number | null;
}

const PENDING_PIXEL = "GetPendingAgentActions(limit=[50]);";
// Bounded so the batched status call below stays one page-load-sized round
// trip rather than growing with the user's total room count.
const RECENT_ROOMS_LIMIT = 12;

const STATUS_LABEL: Record<string, string> = {
	SUBMITTED: "Queued",
	RUNNING: "Running",
	INPUT_REQUIRED: "Waiting on you",
	COMPLETED: "Done",
	FAILED: "Failed",
	CANCELLED: "Cancelled",
};

const statusClass = (status?: string) => {
	switch (status) {
		case "RUNNING":
		case "SUBMITTED":
			return "border-primary/40 text-primary";
		case "FAILED":
			return "border-destructive/40 text-destructive";
		case "INPUT_REQUIRED":
			return "border-warning/40 text-warning";
		case "COMPLETED":
			return "border-success/40 text-success";
		default:
			return "text-muted-foreground";
	}
};

const formatWhen = (value?: string | number | null) => {
	if (value === null || value === undefined || value === "") return "—";
	const ms = typeof value === "number" ? value : Date.parse(String(value));
	return Number.isFinite(ms) ? new Date(ms).toLocaleString() : String(value);
};

const summarizeArgs = (args: unknown): string => {
	if (args === null || args === undefined || args === "") return "";
	try {
		const text =
			typeof args === "string" ? args : JSON.stringify(args, null, 0);
		return text.length > 160 ? `${text.slice(0, 160)}…` : text;
	} catch {
		return "";
	}
};

/**
 * Everything waiting on the user, across every room, plus a scoped look at
 * what your other rooms are doing right now.
 *
 * A room's own HITL card is only visible if you happen to have that room open,
 * so a run parked on an approval is otherwise invisible — and once runs can be
 * scheduled, nobody is watching when they park. The "needs you" section is the
 * one place that answers "what is waiting on me?", backed by
 * GetPendingAgentActions, which is genuinely cross-room.
 *
 * "Recent rooms" is deliberately scoped, not a full live board: there is no
 * bulk "every run status" reactor, so each room's latest status and cost is a
 * real per-room call, batched into one request for your most recent rooms
 * rather than polled or fetched per-room on demand.
 *
 * Deciding still happens in the room, where the full tool context and the
 * approve/edit/reject/respond controls live; each row links there rather than
 * duplicating that UI.
 */
export const InboxPage = observer(() => {
	const { t } = useTranslation(["workspace", "common"]);
	const navigate = useNavigate();
	const insight = useInsight();

	useGlobalBreadcrumbs({
		breadcrumbs: [
			{ name: t("workspace:breadcrumbs.home"), path: "/" },
			{ name: "Inbox", path: "/inbox" },
		],
	});

	// usePixel exposes refresh() rather than taking a key, and re-runs on
	// demand rather than polling: an approval is not so time-critical that it
	// justifies a background poll on every page.
	const pending = usePixel<PendingAction[]>(PENDING_PIXEL, {
		data: [],
		onError: (_d, e) => {
			toast.error(
				e instanceof Error ? e.message : "Failed to load your inbox",
			);
		},
	});

	const getRooms = usePixel<RoomItem[]>(
		`META | GetPlaygroundRooms(limit=[${RECENT_ROOMS_LIMIT}], offset=[0], sort=["DESC"]);`,
		{ data: [] },
	);

	const [recentRuns, setRecentRuns] = useState<Record<string, RecentRun>>({});
	const [recentCosts, setRecentCosts] = useState<Record<string, CostOutput>>(
		{},
	);
	const [recentLoading, setRecentLoading] = useState(false);

	const roomIds = useMemo(
		() => getRooms.data.map((r) => r.ROOM_ID),
		[getRooms.data],
	);

	const fetchRecentStatus = useCallback(async () => {
		if (roomIds.length === 0) {
			setRecentRuns({});
			setRecentCosts({});
			return;
		}
		setRecentLoading(true);
		try {
			const calls = roomIds.flatMap((id) => [
				`GetAgentRunsForRoom(roomId=${JSON.stringify(id)});`,
				`GetModelCost(roomId=${JSON.stringify(id)});`,
			]);
			const { pixelReturn } = await insight.actions.run(calls.join(""));

			const nextRuns: Record<string, RecentRun> = {};
			const nextCosts: Record<string, CostOutput> = {};
			roomIds.forEach((id, i) => {
				const runsReturn = pixelReturn[i * 2];
				const costReturn = pixelReturn[i * 2 + 1];

				const runsFailed =
					!runsReturn ||
					runsReturn.operationType.indexOf("ERROR") > -1;
				if (!runsFailed) {
					// The reactor hands back chronological order for
					// playback (see GetAgentRunsForRoom) — the last entry is
					// the most recent run.
					const runs = (runsReturn.output as RecentRun[]) ?? [];
					const latest = runs[runs.length - 1];
					if (latest) {
						nextRuns[id] = latest;
					}
				}

				const costFailed =
					!costReturn ||
					costReturn.operationType.indexOf("ERROR") > -1;
				if (!costFailed) {
					nextCosts[id] = costReturn.output as CostOutput;
				}
			});
			setRecentRuns(nextRuns);
			setRecentCosts(nextCosts);
		} catch (e) {
			console.error("Could not load recent run status", e);
		} finally {
			setRecentLoading(false);
		}
	}, [insight, roomIds]);

	useEffect(() => {
		void fetchRecentStatus();
	}, [fetchRecentStatus]);

	const actions = Array.isArray(pending.data) ? pending.data : [];
	const isLoading = pending.status === "LOADING";

	// A room already surfaced above as "needs you" would otherwise show again
	// below with a duplicate, less specific status.
	const pendingRoomIds = new Set(actions.map((a) => a.roomId));
	const recentRooms = getRooms.data.filter(
		(r) => !pendingRoomIds.has(r.ROOM_ID),
	);

	const runningCount = Object.values(recentRuns).filter(
		(r) => r.status === "RUNNING" || r.status === "SUBMITTED",
	).length;

	const openRoom = useCallback(
		(roomId?: string) => {
			if (roomId) {
				navigate(`/room/${roomId}`);
			}
		},
		[navigate],
	);

	return (
		<div className="@container h-full w-full overflow-y-auto">
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 @3xl:px-12 @md:px-6 px-4 pt-8 pb-4">
				<div className="flex items-center gap-3">
					<div className="min-w-0 flex-1">
						<h1 className="font-semibold text-2xl">Inbox</h1>
						<p className="text-muted-foreground text-sm">
							What's waiting on you, and what your other rooms are
							doing.
						</p>
					</div>
					{actions.length > 0 ? (
						<Badge
							variant="outline"
							className="border-warning/40 text-warning"
						>
							{actions.length} need you
						</Badge>
					) : null}
					{runningCount > 0 ? (
						<Badge variant="outline" className="text-primary">
							{runningCount} running
						</Badge>
					) : null}
					<Button
						variant="ghost"
						size="sm"
						disabled={isLoading || recentLoading}
						onClick={() => {
							pending.refresh();
							getRooms.refresh();
							void fetchRecentStatus();
						}}
					>
						<RefreshCw className="size-4" />
					</Button>
				</div>

				<div className="flex flex-col gap-4">
					{isLoading && actions.length === 0 ? (
						<>
							<Skeleton className="h-20 w-full" />
							<Skeleton className="h-20 w-full" />
						</>
					) : null}

					{!isLoading && actions.length === 0 ? (
						<div className="flex flex-col items-center gap-2 rounded-md border border-border border-dashed p-10 text-center">
							<InboxIcon className="size-6 text-muted-foreground" />
							<div className="font-medium">
								Nothing waiting on you
							</div>
							<div className="text-muted-foreground text-sm">
								When an agent pauses for approval, it shows up
								here.
							</div>
						</div>
					) : null}

					{actions.map((action, index) => (
						<div
							key={action.actionId ?? `pending-${index}`}
							className="rounded-md border border-warning bg-card p-4"
						>
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="secondary">
									Needs approval
								</Badge>
								<span className="font-mono text-sm">
									{action.toolName ?? "tool"}
								</span>
								<span className="ml-auto text-muted-foreground text-xs">
									{formatWhen(action.dateCreated)}
								</span>
							</div>

							{summarizeArgs(action.toolArgs) ? (
								<pre className="mt-2 overflow-x-auto rounded bg-secondary p-2 font-mono text-xs">
									{summarizeArgs(action.toolArgs)}
								</pre>
							) : null}

							<div className="mt-3 flex items-center gap-2">
								<Button
									size="sm"
									disabled={!action.roomId}
									onClick={() => openRoom(action.roomId)}
								>
									Open room to decide
								</Button>
								{action.runId ? (
									<span className="font-mono text-muted-foreground text-xs">
										run {action.runId.slice(0, 8)}
									</span>
								) : null}
							</div>
						</div>
					))}
				</div>

				{recentRooms.length > 0 ? (
					<div className="flex flex-col gap-3">
						<div>
							<h2 className="font-medium text-sm">
								Recent rooms
							</h2>
							<p className="text-muted-foreground text-xs">
								Latest status among your {RECENT_ROOMS_LIMIT}{" "}
								most recent rooms — not every run you've ever
								started.
							</p>
						</div>
						<div className="grid @2xl:grid-cols-2 grid-cols-1 gap-3">
							{recentRooms.map((room) => {
								const run = recentRuns[room.ROOM_ID];
								const cost = recentCosts[room.ROOM_ID];
								const costValue = cost?.totals?.cost;
								return (
									<button
										key={room.ROOM_ID}
										type="button"
										onClick={() => openRoom(room.ROOM_ID)}
										className="flex flex-col gap-1 rounded-md border border-border bg-card p-3 text-start hover:bg-accent"
									>
										<div className="flex items-center gap-2">
											<span className="min-w-0 flex-1 truncate font-medium text-sm">
												{room.ROOM_NAME || "Untitled"}
											</span>
											{run?.status ? (
												<Badge
													variant="outline"
													className={cn(
														"shrink-0",
														statusClass(run.status),
													)}
												>
													{STATUS_LABEL[run.status] ??
														run.status}
												</Badge>
											) : null}
										</div>
										{run?.input ? (
											<p className="line-clamp-2 text-muted-foreground text-xs">
												{run.input}
											</p>
										) : null}
										<div className="flex items-center gap-2 text-muted-foreground text-xs">
											<span>
												{formatWhen(room.DATE_CREATED)}
											</span>
											{typeof costValue === "number" ? (
												<span>
													{formatCost(
														costValue,
														cost?.totals?.currency,
													)}
												</span>
											) : null}
										</div>
									</button>
								);
							})}
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
});
