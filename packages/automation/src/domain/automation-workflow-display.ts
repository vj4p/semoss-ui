import {
	Bot,
	Braces,
	BrainCircuit,
	Database,
	FolderOpen,
	FunctionSquare,
	GitBranch,
	ListTree,
	type LucideIcon,
	Network,
	Repeat2,
	SlidersHorizontal,
	Sparkles,
	Variable,
} from "lucide-react";
import { getAutomationNodeDefinition } from "./automation-node-catalog";
import type { AutomationWorkflowNodeType } from "./automation-workflow.types";

/** Visual metadata shared by workflow-node pickers and canvas cards. */
export interface AutomationWorkflowNodeDisplay {
	icon: LucideIcon;
	color: string;
}

export function getWorkflowNodeDisplay(
	type: AutomationWorkflowNodeType,
): AutomationWorkflowNodeDisplay {
	const category = getAutomationNodeDefinition(type)?.category;
	if (type === "trigger.start") {
		return { icon: Braces, color: "text-success" };
	}
	if (category === "database") {
		return { icon: Database, color: "text-info" };
	}
	if (category === "model") {
		return { icon: Sparkles, color: "text-chart-4" };
	}
	if (category === "agent") {
		return { icon: Bot, color: "text-chart-4" };
	}
	if (category === "storage") {
		return { icon: FolderOpen, color: "text-success" };
	}
	if (category === "data") {
		return { icon: ListTree, color: "text-chart-2" };
	}
	if (category === "vector") {
		return { icon: Network, color: "text-warning" };
	}
	if (category === "function") {
		return { icon: FunctionSquare, color: "text-info" };
	}
	if (category === "app") {
		return { icon: Variable, color: "text-muted-foreground" };
	}
	if (type === "control.wait") {
		return { icon: SlidersHorizontal, color: "text-info" };
	}
	if (type === "control.if") {
		return { icon: GitBranch, color: "text-warning" };
	}
	if (type === "control.jev") {
		return { icon: BrainCircuit, color: "text-chart-4" };
	}
	if (type === "control.loop") {
		return { icon: Repeat2, color: "text-primary-text" };
	}
	return { icon: Braces, color: "text-primary-text" };
}
