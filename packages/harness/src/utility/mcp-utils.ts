import { createMcpPlatformUrl, createPromptPlatformUrl } from "@semoss/shared";
import { MCP_EXECUTION_AGENT_ASK, MCP_EXECUTION_ASK } from "@/constants";

export { isKnowledgeMcp, splitMcpByType } from "@semoss/shared";

/**
 * Whether a tool's execution mode means "needs an interactive decision",
 * covering both the legacy ask flow and an agent-run tool awaiting approval
 * (which carries agent-ask instead of ask, since agent-run tools are never
 * client-dispatched — see MCP_EXECUTION_AGENT_ASK).
 */
export const isAskExecutionMode = (execution: string | undefined): boolean =>
	execution === MCP_EXECUTION_ASK || execution === MCP_EXECUTION_AGENT_ASK;

/**
 * Reserved id the backend puts on SMSS_ENGINE_ID for room scoped tools. There is
 * no catalog entry behind it: it tells the backend to read the tools from the
 * room's own asset folder, so it must never be used as a project or engine id.
 */
const ROOM_MCP_ID = "__room__";

/** The subset of a tool's `_meta` that carries its owning app. */
type ToolOwnerMeta = {
	SMSS_ENGINE_ID?: string;
	SMSS_PROJECT_ID?: string;
};

/**
 * Id to pass to backend pixels that resolve a tool, such as RunMCPTool.
 *
 * SMSS_ENGINE_ID is the canonical key and is set for every engine type; the
 * deprecated SMSS_PROJECT_ID is only a fallback for older tool definitions. The
 * room sentinel is kept because the backend resolves room tools by it.
 */
export const getToolEngineId = (meta: ToolOwnerMeta | undefined): string =>
	meta?.SMSS_ENGINE_ID || meta?.SMSS_PROJECT_ID || "";

/**
 * Id to use when loading a tool's UI or looking up its metadata, where the value
 * has to be a real catalog entry. Same preference as {@link getToolEngineId},
 * except the room sentinel resolves to empty so callers skip the lookup rather
 * than asking the catalog for an id that cannot exist.
 */
export const getToolAppId = (meta: ToolOwnerMeta | undefined): string => {
	const engineId = getToolEngineId(meta);
	return engineId === ROOM_MCP_ID ? "" : engineId;
};

const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL ?? "";

export const mcpToPlatformUrl = createMcpPlatformUrl(PLATFORM_URL);
export const promptToPlatformUrl = createPromptPlatformUrl(PLATFORM_URL);

/**
 * Whether a paused call belongs to a harness that runs its own tools (Claude Code). Those tools are not toolbox
 * tools, so there is no schema to render a form from and the decision never executes anything here: approving
 * lets the agent run the call itself once.
 */
export const isHarnessNativeAction = (
	action: { toolMeta?: Record<string, unknown> | null } | null | undefined,
): boolean => Boolean(action?.toolMeta?.SMSS_HARNESS_NATIVE);

/**
 * A tool an agent ran itself: it has an agent execution mode but no toolbox or engine behind it (Claude Code's Bash,
 * Read, Edit, and the platform's own file tools). There is no schema to fetch for it, so it gets the read-only view.
 */
export const isAgentOwnedTool = (
	meta: (ToolOwnerMeta & { SMSS_MCP_EXECUTION?: string }) | undefined,
): boolean =>
	typeof meta?.SMSS_MCP_EXECUTION === "string" &&
	meta.SMSS_MCP_EXECUTION.startsWith("agent-") &&
	!getToolEngineId(meta);
