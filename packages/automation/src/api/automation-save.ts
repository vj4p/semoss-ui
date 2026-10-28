import { runPixel } from "@semoss/sdk";
import { encodeTextToBase64 } from "@semoss/utility/encoding";
import type { AutomationScopeEntry } from "../domain/automation-inspector";
import {
	type CanvasWorkflowDocument,
	canvasDocumentToWorkflow,
	getCanvasNodeSources,
} from "../domain/automation-workflow-adapter";

/** What the backend reports back after it has stored an automation. */
export interface AutomationSaveResult {
	/** The revision the save produced; pass it as `expectedRevision` on the next save. */
	revision?: string;
	/** Python sources the backend normalised, keyed by step id. */
	nodeSources?: Record<string, string>;
	/** The variables each step can read, keyed by step id. */
	scopeVariables?: Record<string, AutomationScopeEntry[]>;
}

/**
 * Builds the Pixel that stores an automation. With `expectedRevision` the backend
 * refuses the save if anyone has saved since that revision.
 */
export function buildSaveAutomationPixel(
	appId: string,
	canvas: CanvasWorkflowDocument,
	expectedRevision?: string | null,
): string {
	const definitionPayload = encodeTextToBase64(
		JSON.stringify(canvasDocumentToWorkflow(canvas)),
	);
	const nodeSourcesPayload = encodeTextToBase64(
		JSON.stringify(getCanvasNodeSources(canvas.steps)),
	);
	const expectedRevisionArgument = expectedRevision
		? `, expectedRevision=${JSON.stringify([expectedRevision])}`
		: "";
	return `SaveAutomation(project=${JSON.stringify([appId])}, json=${JSON.stringify([definitionPayload])}, nodeSources=${JSON.stringify([nodeSourcesPayload])}${expectedRevisionArgument});`;
}

/**
 * Saves an automation. Rejects with the backend's message when the save fails,
 * including when `expectedRevision` is stale ("Automation changed since it was
 * loaded").
 */
export async function saveAutomation(
	appId: string,
	canvas: CanvasWorkflowDocument,
	expectedRevision?: string | null,
): Promise<AutomationSaveResult> {
	const response = await runPixel(
		buildSaveAutomationPixel(appId, canvas, expectedRevision),
	);
	if (response.errors.length > 0) {
		throw new Error(response.errors.join("\n"));
	}
	return parseSaveResult(response.pixelReturn?.[0]?.output);
}

function parseSaveResult(output: unknown): AutomationSaveResult {
	if (typeof output !== "object" || output === null) return {};
	const { revision, nodeSources, scopeVariables } = output as Record<
		string,
		unknown
	>;
	return {
		...(typeof revision === "string" ? { revision } : {}),
		...(isRecord(nodeSources)
			? { nodeSources: nodeSources as Record<string, string> }
			: {}),
		...(isRecord(scopeVariables)
			? {
					scopeVariables: scopeVariables as Record<
						string,
						AutomationScopeEntry[]
					>,
				}
			: {}),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
