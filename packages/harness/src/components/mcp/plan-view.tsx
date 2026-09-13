import { CheckCircle2Icon, CircleIcon, Loader2Icon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "@semoss/i18n";
import { cn } from "@semoss/ui/next";
import type { ToolStore } from "@/stores";
import { ToolCardHeader, ToolTabScrollArea } from "./tool-card-tabs";

interface TodoItem {
	id?: string;
	content: string;
	status?: "pending" | "in_progress" | "completed";
	priority?: "high" | "medium" | "low";
}

const parseTodos = (raw: unknown): TodoItem[] => {
	const text =
		typeof raw === "string" ? raw : raw != null ? JSON.stringify(raw) : "";
	if (!text) {
		return [];
	}
	try {
		const parsed = JSON.parse(text);
		return Array.isArray(parsed)
			? parsed.filter(
					(item): item is TodoItem =>
						!!item && typeof item.content === "string",
				)
			: [];
	} catch {
		return [];
	}
};

const STATUS_ICON: Record<NonNullable<TodoItem["status"]>, React.ReactNode> = {
	completed: <CheckCircle2Icon className="size-4 text-success" />,
	in_progress: <Loader2Icon className="size-4 animate-spin text-primary" />,
	pending: <CircleIcon className="size-4 text-muted-foreground" />,
};

const PRIORITY_DOT: Record<string, string> = {
	high: "bg-destructive",
	medium: "bg-warning",
	low: "bg-muted-foreground",
};

interface PlanViewProps {
	/** TodoWrite or TodoRead call to render as a checklist. */
	tool: ToolStore;
}

/**
 * TodoWrite/TodoRead as a checklist instead of the generic inputs/output
 * form. `items_json` is a validated full-state replace, not arguments meant
 * to be inspected or edited field-by-field, so the schema-driven form
 * (JSON-in-a-textarea) only ever showed the plan as an unreadable blob.
 */
export const PlanView: React.FC<PlanViewProps> = observer(({ tool }) => {
	const { t } = useTranslation("tool");
	const isWrite = tool.json.name === "TodoWrite";
	// TodoWrite's plan is the call's own argument — current the moment it
	// streams in. TodoRead has no arguments; its plan is the call's result,
	// so there is nothing to show until it resolves.
	const source = isWrite ? tool.parameters?.items_json : tool.response;
	const loading = !isWrite && tool.status !== "SUCCESS";
	const todos = loading ? [] : parseTodos(source);
	const doneCount = todos.filter(
		(item) => item.status === "completed",
	).length;

	return (
		<div className="flex h-full w-full flex-col overflow-hidden text-foreground">
			<ToolCardHeader title={t("plan.title")} />
			<ToolTabScrollArea>
				{loading ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						{t("plan.loading")}
					</p>
				) : todos.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						{t("plan.empty")}
					</p>
				) : (
					<>
						<p className="text-muted-foreground text-xs">
							{t("plan.progress", {
								done: doneCount,
								total: todos.length,
							})}
						</p>
						{todos.map((item, i) => (
							<div
								key={item.id ?? i}
								className="flex items-start gap-2 rounded-md px-2 py-1.5"
							>
								<span className="mt-0.5 shrink-0">
									{STATUS_ICON[item.status ?? "pending"]}
								</span>
								<span
									className={cn(
										"flex-1 text-sm",
										item.status === "completed" &&
											"text-muted-foreground line-through",
									)}
								>
									{item.content}
								</span>
								{item.priority ? (
									<span
										title={item.priority}
										className={cn(
											"mt-2 size-1.5 shrink-0 rounded-full",
											PRIORITY_DOT[item.priority] ??
												"bg-muted-foreground",
										)}
									/>
								) : null}
							</div>
						))}
					</>
				)}
			</ToolTabScrollArea>
		</div>
	);
});
