import { InboxIcon, RefreshCw } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "@semoss/i18n";
import { usePixel } from "@semoss/sdk/react";
import { Badge, Button, Skeleton, toast } from "@semoss/ui/next";
import { useGlobalBreadcrumbs } from "@/hooks";

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

const PENDING_PIXEL = "GetPendingAgentActions(limit=[50]);";

const formatWhen = (value?: string) => {
	if (!value) return "—";
	const ms = Date.parse(value);
	return Number.isFinite(ms) ? new Date(ms).toLocaleString() : value;
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
 * Everything waiting on the user, across every room.
 *
 * A room's own HITL card is only visible if you happen to have that room open,
 * so a run parked on an approval is otherwise invisible — and once runs can be
 * scheduled, nobody is watching when they park. This is the one place that
 * answers "what is waiting on me?".
 *
 * Deciding still happens in the room, where the full tool context and the
 * approve/edit/reject/respond controls live; each row links there rather than
 * duplicating that UI.
 */
export const InboxPage = observer(() => {
	const { t } = useTranslation(["workspace", "common"]);
	const navigate = useNavigate();

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

	const actions = Array.isArray(pending.data) ? pending.data : [];
	const isLoading = pending.status === "LOADING";

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
			<div className="mx-auto flex w-full max-w-3xl flex-col gap-4 @3xl:px-12 @md:px-6 px-4 pt-8 pb-4">
				<div className="flex items-center gap-3">
					<div className="min-w-0 flex-1">
						<h1 className="font-semibold text-2xl">Inbox</h1>
						<p className="text-muted-foreground text-sm">
							Agent runs paused for your decision, from every
							room.
						</p>
					</div>
					{actions.length > 0 ? (
						<Badge variant="secondary">{actions.length}</Badge>
					) : null}
					<Button
						variant="ghost"
						size="sm"
						disabled={isLoading}
						onClick={() => pending.refresh()}
					>
						<RefreshCw className="size-4" />
					</Button>
				</div>

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
							When an agent pauses for approval, it shows up here.
						</div>
					</div>
				) : null}

				{actions.map((action, index) => (
					<div
						key={action.actionId ?? `pending-${index}`}
						className="rounded-md border border-warning bg-card p-4"
					>
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="secondary">Needs approval</Badge>
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
		</div>
	);
});
