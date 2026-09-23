/**
 * Harness names that shipped with this build.
 *
 * This is the compile-time union `harnessType` is typed against, and the
 * fallback a picker uses when the backend cannot be reached. It is NOT the list
 * a picker should render: `GetAgentHarnesses` is, via `useAgentHarnesses`, since
 * a deployment can register its own harness at startup and the backend decides
 * which are offered (`IAgentHarness.isSelectable`).
 *
 * Still must not contain a name AgentHarnessRegistry lacks - resolve() throws
 * IllegalArgumentException on any other nonblank value.
 */
export const AGENT_HARNESS_TYPES = [
	"semoss",
	"claude_code",
	"github_copilot_py",
] as const;

export type AgentHarnessType = (typeof AGENT_HARNESS_TYPES)[number];

/** Mirrors AgentHarnessRegistry.DEFAULT_HARNESS. */
export const DEFAULT_AGENT_HARNESS_TYPE: AgentHarnessType = "semoss";

export const isAgentHarnessType = (
	value: string | undefined,
): value is AgentHarnessType =>
	!!value && (AGENT_HARNESS_TYPES as readonly string[]).includes(value);
