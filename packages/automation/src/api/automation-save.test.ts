import { beforeEach, describe, expect, it, vi } from "vitest";
import { runPixel } from "@semoss/sdk";
import { encodeTextToBase64 } from "@semoss/utility/encoding";
import type { CanvasWorkflowDocument } from "../domain/automation-workflow-adapter";
import {
	canvasDocumentToWorkflow,
	getCanvasNodeSources,
} from "../domain/automation-workflow-adapter";
import { buildSaveAutomationPixel, saveAutomation } from "./automation-save";

vi.mock("@semoss/sdk", () => ({ runPixel: vi.fn() }));

const canvas: CanvasWorkflowDocument = {
	description: 'Nightly "load" of rows',
	triggerBindings: [],
	steps: [],
	edges: [],
};

function pixelResponse(output: unknown, errors: string[] = []) {
	return {
		errors,
		insightId: "insight-1",
		pixelReturn: [
			{
				isMeta: false,
				operationType: ["MAP"],
				output,
				pixelExpression: "",
				pixelId: "0",
				timeToRun: 0,
			},
		],
	};
}

describe("buildSaveAutomationPixel", () => {
	it("encodes the definition and node sources and quotes the project id", () => {
		const pixel = buildSaveAutomationPixel('app "1"', canvas);
		const definition = encodeTextToBase64(
			JSON.stringify(canvasDocumentToWorkflow(canvas)),
		);
		const sources = encodeTextToBase64(
			JSON.stringify(getCanvasNodeSources(canvas.steps)),
		);
		expect(pixel).toBe(
			`SaveAutomation(project=${JSON.stringify(['app "1"'])}, json=${JSON.stringify([definition])}, nodeSources=${JSON.stringify([sources])});`,
		);
		expect(pixel).toContain('project=["app \\"1\\""]');
		expect(pixel).not.toContain("expectedRevision");
	});

	it("adds the revision guard only when there is a revision", () => {
		expect(buildSaveAutomationPixel("app-1", canvas, "rev-2")).toMatch(
			/, expectedRevision=\["rev-2"\]\);$/,
		);
		expect(buildSaveAutomationPixel("app-1", canvas, null)).not.toContain(
			"expectedRevision",
		);
		expect(buildSaveAutomationPixel("app-1", canvas, "")).not.toContain(
			"expectedRevision",
		);
	});
});

describe("saveAutomation", () => {
	beforeEach(() => vi.resetAllMocks());

	it("returns the revision, node sources and scope variables the backend sent", async () => {
		vi.mocked(runPixel).mockResolvedValue(
			pixelResponse({
				revision: "rev-3",
				nodeSources: { step: "print(1)" },
				scopeVariables: { step: [] },
				extra: "ignored",
			}),
		);
		await expect(saveAutomation("app-1", canvas, "rev-2")).resolves.toEqual(
			{
				revision: "rev-3",
				nodeSources: { step: "print(1)" },
				scopeVariables: { step: [] },
			},
		);
		expect(runPixel).toHaveBeenCalledWith(
			buildSaveAutomationPixel("app-1", canvas, "rev-2"),
		);
	});

	it("tolerates a save that returns nothing usable", async () => {
		vi.mocked(runPixel).mockResolvedValue(pixelResponse("saved"));
		await expect(saveAutomation("app-1", canvas)).resolves.toEqual({});
		vi.mocked(runPixel).mockResolvedValue(
			pixelResponse({
				revision: 7,
				nodeSources: [],
				scopeVariables: null,
			}),
		);
		await expect(saveAutomation("app-1", canvas)).resolves.toEqual({});
	});

	it("surfaces the backend's errors, including a stale revision", async () => {
		vi.mocked(runPixel).mockResolvedValue(
			pixelResponse(undefined, [
				"Automation changed since it was loaded",
				"second line",
			]),
		);
		await expect(saveAutomation("app-1", canvas, "rev-1")).rejects.toThrow(
			"Automation changed since it was loaded\nsecond line",
		);
	});
});
