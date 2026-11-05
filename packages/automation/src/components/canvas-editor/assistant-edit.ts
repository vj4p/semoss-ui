/**
 * The canvas refreshes for two kinds of reason: the assistant changed the
 * automation behind it, or the canvas itself did (a reload, an Undo, or a
 * restored version). Only the first is an edit that Undo can take back; for
 * the others the canvas already shows the saved automation, and offering to
 * undo would overwrite exactly what the person just asked for.
 */
const CANVAS_OWN_TOOLS: ReadonlySet<string> = new Set([
	"reload",
	"undo",
	"rollback",
]);

/**
 * Whether a canvas refresh was caused by the assistant editing the automation.
 *
 * @param toolName - The tool that triggered the refresh, such as `"reload"`.
 * @returns True when the assistant made the change, so the canvas as it was
 * should be kept to undo to.
 */
export const isAssistantEdit = (toolName: string): boolean =>
	!CANVAS_OWN_TOOLS.has(toolName);
