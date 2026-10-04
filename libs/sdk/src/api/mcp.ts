import { runPixel } from "./pixel";

/** MCP tool capability descriptor */
export interface MCPToolCapability {
	type: "read" | "write" | "execute" | "network";
	description: string;
}

/** MCP tool categories */
export type MCPToolCategory =
	| "filesystem"
	| "web"
	| "database"
	| "api"
	| "email"
	| "search"
	| "code"
	| "other";

/** MCP tool descriptor from backend */
export interface MCPToolDescriptor {
	id: string;
	name: string;
	description: string;
	category: MCPToolCategory;
	tags: string[];
	capabilities: MCPToolCapability[];
	engineId?: string;
	isEnabled: boolean;
	metadata?: {
		version?: string;
		provider?: string;
		lastUsed?: string;
	};
}

/**
 * Parse backend tool descriptor into frontend format.
 */
function parseToolDescriptor(raw: Record<string, unknown>): MCPToolDescriptor {
	const capabilityTypes = ["read", "write", "execute", "network"];
	return {
		id: (raw.id as string) || (raw.toolId as string) || "",
		name:
			(raw.name as string) ||
			(raw.displayName as string) ||
			"Unknown Tool",
		description: (raw.description as string) || "",
		category: ((raw.category as string) || "other") as MCPToolCategory,
		tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
		capabilities: Array.isArray(raw.capabilities)
			? (raw.capabilities as Record<string, unknown>[]).map(
					(c: Record<string, unknown>) => {
						const type = ((c.type as string) || "read") as
							| "read"
							| "write"
							| "execute"
							| "network";
						return {
							type: capabilityTypes.includes(type)
								? type
								: "read",
							description: (c.description as string) || "",
						};
					},
				)
			: [],
		engineId: (raw.engineId as string) || undefined,
		isEnabled: (raw.isEnabled as boolean) || false,
		metadata: (raw.metadata as Record<string, string>) || {},
	};
}

/**
 * Get available MCP tools for an engine/project.
 * Calls: GetMCPTools(engine=<id>)
 *
 * @param engineId - Optional engine/project ID to scope tools
 * @param insightId - Optional insight ID for the Pixel call
 * @returns Array of MCP tool descriptors
 */
export async function getMCPTools(
	engineId?: string,
	insightId?: string,
): Promise<MCPToolDescriptor[]> {
	try {
		const pixel = engineId
			? `GetMCPTools(engine="${engineId}");`
			: "GetMCPTools();";

		const result = await runPixel(pixel, { insightId });

		// Parse backend response
		if (!result || typeof result !== "object") {
			return [];
		}

		// Backend returns: { tools: [...] }
		const tools = (result.tools as Record<string, unknown>[]) || [];
		if (!Array.isArray(tools)) {
			return [];
		}

		return tools.map(parseToolDescriptor);
	} catch (error) {
		console.error("Failed to fetch MCP tools:", error);
		return [];
	}
}

/**
 * Update room's enabled MCP tools.
 * Calls: SetRoomMCPTools(roomId=<id>, tools=[...])
 *
 * @param roomId - Room ID to update
 * @param toolIds - Array of enabled tool IDs
 * @param insightId - Optional insight ID
 */
export async function setRoomMCPTools(
	roomId: string,
	toolIds: string[],
	insightId?: string,
): Promise<void> {
	const toolsJson = JSON.stringify(toolIds);
	const pixel = `SetRoomMCPTools(roomId="${roomId}", tools=${toolsJson});`;

	await runPixel(pixel, { insightId });
}

/**
 * Get room's currently enabled MCP tools.
 * Calls: GetRoomMCPTools(roomId=<id>)
 *
 * @param roomId - Room ID to query
 * @param insightId - Optional insight ID
 * @returns Array of enabled tool IDs
 */
export async function getRoomMCPTools(
	roomId: string,
	insightId?: string,
): Promise<string[]> {
	try {
		const pixel = `GetRoomMCPTools(roomId="${roomId}");`;
		const result = await runPixel(pixel, { insightId });

		const tools = (result?.tools as string[]) || [];
		if (!Array.isArray(tools)) {
			return [];
		}
		return tools;
	} catch (error) {
		console.error("Failed to fetch room MCP tools:", error);
		return [];
	}
}
