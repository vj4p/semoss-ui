import type { RunExport } from "@semoss/agent-core";

/** How long the file's URL outlives the click that downloads it. */
const REVOKE_AFTER_MS = 60_000;

/**
 * Save a run's export as a JSON file, through the browser's download.
 *
 * @name downloadRunExport
 * @param data - The export `:export` produced.
 */
export const downloadRunExport = (data: RunExport): void => {
	const blob = new Blob([JSON.stringify(data, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `semoss-code-run-${data.runId.replace(/[^\w.-]/g, "_")}.json`;
	link.click();
	// Revoked later rather than at once: a browser can read the URL after
	// click() returns, and from a revoked URL it downloads nothing.
	window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
};
