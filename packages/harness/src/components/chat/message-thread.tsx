import type { AgentRunItem } from "@semoss/sdk";
import { ToolCallCard } from "./tool-call-card";

interface MessageThreadProps {
	items: AgentRunItem[];
}

export const MessageThread = ({ items }: MessageThreadProps) => {
	return (
		<div className="flex flex-col gap-3 overflow-auto p-4">
			{items.map((item) => {
				if (item.kind === "tool") {
					return <ToolCallCard key={item.id} item={item} />;
				}
				if (item.kind === "message") {
					return (
						<p
							key={item.id}
							className="whitespace-pre-wrap text-sm"
						>
							{item.text}
						</p>
					);
				}
				if (item.kind === "reasoning") {
					return (
						<p
							key={item.id}
							className="text-muted-foreground text-xs italic"
						>
							{item.summary}
						</p>
					);
				}
				return null;
			})}
		</div>
	);
};
