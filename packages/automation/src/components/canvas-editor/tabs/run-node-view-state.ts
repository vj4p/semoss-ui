import type { AutomationRunFramePage } from "../../../api/automation-history";
import type {
	AutomationNodeResult,
	AutomationSavedResultPage,
	AutomationSavedResultReference,
} from "../../../domain/automation.types";

export interface RunNodeOccurrence {
	parentNodeId?: string | null;
	iterationIndex?: number | null;
}

export type RunNodeDataSource =
	| {
			kind: "retained";
			savedResult: AutomationSavedResultReference;
	  }
	| {
			kind: "live";
			insightId: string;
			frame: NonNullable<AutomationNodeResult["OUTPUT_FRAME"]>;
	  }
	| { kind: "preview" };

export type AsyncViewerState = "loading" | "error" | "empty" | "ready";
export type RunNodeContentView = "output" | "input" | "variables" | "source";

const RUN_NODE_CONTENT_VIEWS: readonly string[] = [
	"output",
	"input",
	"variables",
	"source",
] satisfies RunNodeContentView[];

/** Narrows a tab value to one of the detail views. */
export function isRunNodeContentView(
	value: string,
): value is RunNodeContentView {
	return RUN_NODE_CONTENT_VIEWS.includes(value);
}

export const RUN_NODE_VIEW_LABELS = {
	navigation: "Run nodes",
	detailView: "Run node detail view",
	output: "Output",
	input: "Input",
	variables: "Variables",
	source: "Implementation",
	outputData: "Automation node output data",
	executedSource: "Executed Automation implementation",
	retryData: "Retry loading node data",
	retrySource: "Retry loading executed implementation",
} as const;

export const RUN_RESULTS_LAYOUT_CLASSES = {
	root: "flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row",
	navigation:
		"max-h-48 w-full shrink-0 overflow-y-auto border-border border-b bg-muted/20 p-2 sm:max-h-none sm:w-56 sm:border-r sm:border-b-0",
	content: "min-w-0 flex-1 overflow-y-auto p-3",
	tabPanel: "outline-none focus-visible:outline-2 focus-visible:outline-ring",
	scrollRegion:
		"max-h-[28rem] overflow-auto rounded-md border focus-visible:outline-2 focus-visible:outline-ring",
} as const;

/** Selects retained output before the shorter-lived execution frame. */
export function getRunNodeDataSource(
	savedResult: AutomationSavedResultReference | undefined,
	insightId: string | null | undefined,
	frame: AutomationNodeResult["OUTPUT_FRAME"] | undefined,
): RunNodeDataSource {
	if (savedResult?.RESULT_KIND === "TABLE") {
		return { kind: "retained", savedResult };
	}
	if (insightId && frame) {
		return { kind: "live", insightId, frame };
	}
	return { kind: "preview" };
}

/** Finds the durable result for one root node or one exact loop occurrence. */
export function findSavedResultForOccurrence(
	savedResults: AutomationSavedResultReference[],
	nodeId: string,
	occurrence?: RunNodeOccurrence | null,
): AutomationSavedResultReference | undefined {
	const parentNodeId = occurrence?.parentNodeId ?? null;
	const iterationIndex = occurrence?.iterationIndex ?? null;
	return savedResults.find(
		(result) =>
			result.NODE_ID === nodeId &&
			(result.PARENT_NODE_ID ?? null) === parentNodeId &&
			(result.ITERATION_INDEX ?? null) === iterationIndex,
	);
}

/** Produces a stable identity for stateful viewers of repeated loop body nodes. */
export function getRunNodeOccurrenceKey(
	runId: string,
	nodeId: string,
	occurrence?: RunNodeOccurrence | null,
): string {
	return JSON.stringify([
		runId,
		nodeId,
		occurrence?.parentNodeId ?? null,
		occurrence?.iterationIndex ?? null,
	]);
}

/** Maps a validated retained table page into the common data-view model. */
export function mapSavedResultPage(
	result: AutomationSavedResultPage,
): AutomationRunFramePage {
	return {
		headers: result.schema?.map((column) => column.name) ?? [],
		rows: result.rows ?? [],
		total: result.ROW_COUNT ?? result.rows?.length ?? 0,
		nextOffset: result.nextOffset,
		hasMore: result.hasMore,
	};
}

/** Derives the product-visible state for a data or source viewer. */
export function getAsyncViewerState(
	isLoading: boolean,
	error: string | null,
	hasValue: boolean,
	isEmpty: boolean,
): AsyncViewerState {
	if (isLoading && !hasValue) return "loading";
	if (error) return "error";
	if (!hasValue || isEmpty) return "empty";
	return "ready";
}

/** Which of the optional detail views a step has data for. */
export interface RunNodeAvailableViews {
	input: boolean;
	variables: boolean;
}

/**
 * Which optional views a selection has data for. The run's input belongs to the
 * run as a whole, so it is not offered for a step inside a loop iteration.
 */
export function getAvailableRunNodeViews(
	runInput: string | undefined,
	result: Pick<AutomationNodeResult, "inputVariables"> | null,
	isLoopIterationSelected: boolean,
): RunNodeAvailableViews {
	return {
		input: Boolean(runInput) && !isLoopIterationSelected,
		variables: Boolean(result?.inputVariables),
	};
}

/**
 * Restricts implementation details to the workbench's explicit developer mode,
 * and the input and variables views to a step that has them: the backend sends
 * those only to someone who can edit the automation.
 */
export function getVisibleRunNodeContentView(
	requestedView: RunNodeContentView,
	devMode: boolean,
	available: RunNodeAvailableViews = { input: false, variables: false },
): RunNodeContentView {
	switch (requestedView) {
		case "source":
			return devMode ? "source" : "output";
		case "input":
			return available.input ? "input" : "output";
		case "variables":
			return available.variables ? "variables" : "output";
		default:
			return "output";
	}
}
