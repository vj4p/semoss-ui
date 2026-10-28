import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { runPixel } from "@semoss/sdk";
import { Spinner } from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";
import { type PendingAction, parsePendingActions } from "./pending-actions";
import { formatAgo } from "./server-time";

export interface InboxOverlayProps {
	open: boolean;
	onDismiss: () => void;
}

/**
 * The `:inbox` overlay — the agent actions waiting on you, across all your rooms.
 *
 * An agent that wants to do something a person must approve waits in its own
 * room, so a console on a different room would never hear of it. The list is
 * the platform's own, scoped to the signed-in user. Deciding an action happens
 * in its room, so each row opens that room.
 */
export const InboxOverlay = ({ open, onDismiss }: InboxOverlayProps) => {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);
	const [actions, setActions] = useState<PendingAction[]>([]);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		runPixel<[unknown]>("GetPendingAgentActions();")
			.then((response) => {
				if (cancelled) return;
				if (response.errors.length > 0) {
					throw new Error(response.errors[0]);
				}
				setActions(
					parsePendingActions(response.pixelReturn[0]?.output),
				);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				setActions([]);
				setError(
					err instanceof Error
						? err.message
						: "Could not load the inbox",
				);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open]);

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":inbox">
			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Spinner />
				</div>
			) : error ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono text-destructive text-sm">
						{error}
					</p>
					<p className="text-muted-foreground text-xs">
						Unable to load the inbox
					</p>
				</div>
			) : actions.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono font-semibold text-sm">
						Nothing waiting on you
					</p>
					<p className="text-muted-foreground text-xs">
						Actions an agent needs you to approve will appear here.
					</p>
				</div>
			) : (
				<div className="space-y-2">
					<p className="mb-4 font-mono text-muted-foreground text-sm">
						Waiting on you ({actions.length})
					</p>
					{actions.map((action) => (
						<div
							key={action.id}
							className="flex items-center justify-between gap-3 rounded border p-3"
						>
							<div className="min-w-0">
								<p className="truncate font-mono text-sm">
									Approve {action.tool}
								</p>
								<p className="font-mono text-muted-foreground text-xs">
									{action.createdAt
										? formatAgo(action.createdAt)
										: "unknown time"}
									{" · room "}
									{action.roomId.slice(0, 8)}
								</p>
							</div>
							<button
								type="button"
								onClick={() => {
									onDismiss();
									navigate(
										`/room/${encodeURIComponent(action.roomId)}`,
									);
								}}
								className="shrink-0 rounded border px-3 py-1 font-mono text-sm hover:bg-accent"
							>
								Open room
							</button>
						</div>
					))}
				</div>
			)}
		</OverlayContainer>
	);
};
