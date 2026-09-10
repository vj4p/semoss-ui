import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import type React from "react";
import type { AgentRunItem } from "@semoss/sdk";

interface ToolCallCardProps {
	item: Extract<AgentRunItem, { kind: "tool" }>;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
	QUEUED: <CircleDashed className="size-4 text-muted-foreground" />,
	RUNNING: <Loader2 className="size-4 animate-spin text-primary" />,
	COMPLETED: <CheckCircle2 className="size-4 text-green-600" />,
	FAILED: <XCircle className="size-4 text-destructive" />,
	REJECTED: <XCircle className="size-4 text-destructive" />,
	CANCELLED: <XCircle className="size-4 text-muted-foreground" />,
};

export const ToolCallCard = ({ item }: ToolCallCardProps) => {
	return (
		<div className="flex flex-col gap-1 rounded-md border bg-card p-3 text-sm">
			<div className="flex items-center gap-2">
				{STATUS_ICON[item.status] ?? STATUS_ICON.QUEUED}
				<span className="font-medium">{item.title ?? item.name}</span>
				{item.durationMs !== undefined && (
					<span className="text-muted-foreground text-xs">
						{(item.durationMs / 1000).toFixed(1)}s
					</span>
				)}
			</div>
			{item.output && (
				<pre className="whitespace-pre-wrap text-muted-foreground text-xs">
					{item.output}
				</pre>
			)}
			{item.error && (
				<p className="text-destructive text-xs">{item.error}</p>
			)}
		</div>
	);
};
