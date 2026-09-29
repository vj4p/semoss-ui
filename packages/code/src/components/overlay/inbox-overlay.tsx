import { OverlayContainer } from "./overlay-container";

export interface InboxOverlayProps {
	open: boolean;
	onDismiss: () => void;
}

/**
 * The `:inbox` overlay — displays notifications and messages for the user.
 * Phase 4c placeholder for future collaboration/notification features.
 */
export const InboxOverlay = ({ open, onDismiss }: InboxOverlayProps) => {
	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":inbox">
			<div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
				<div className="rounded-full bg-accent/20 p-6">
					<svg
						className="h-12 w-12 text-muted-foreground"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						role="img"
						aria-label="Inbox icon"
					>
						<title>Inbox</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
						/>
					</svg>
				</div>
				<div className="space-y-2">
					<p className="font-mono font-semibold">Inbox is empty</p>
					<p className="text-muted-foreground text-sm">
						No new notifications or messages
					</p>
				</div>
				<div className="mt-4 max-w-md space-y-2 rounded border border-blue-200 bg-blue-50 p-3 text-left dark:border-blue-800 dark:bg-blue-950/30">
					<p className="font-mono text-blue-900 text-xs dark:text-blue-100">
						<strong>Coming soon:</strong>
					</p>
					<ul className="ml-4 list-disc space-y-1 text-blue-900 text-xs dark:text-blue-100">
						<li>Agent run notifications</li>
						<li>Collaboration messages</li>
						<li>System alerts</li>
						<li>Shared room invites</li>
					</ul>
				</div>
			</div>
		</OverlayContainer>
	);
};
