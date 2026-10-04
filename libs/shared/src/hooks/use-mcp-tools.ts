import { useCallback, useEffect, useState } from "react";
import { getMCPTools, type MCPToolDescriptor } from "@semoss/sdk";

/** MCP tool option for picker UI */
export interface MCPToolOption {
	id: string;
	name: string;
	description: string;
	category: string;
	tags: string[];
	capabilities: Array<{ type: string; description: string }>;
	isEnabled: boolean;
}

interface UseMCPToolsOptions {
	engineId?: string;
	insightId?: string;
	fallback?: MCPToolOption[];
	autoFetch?: boolean;
}

interface UseMCPToolsReturn {
	tools: MCPToolOption[];
	loading: boolean;
	error: Error | null;
	refetch: () => Promise<void>;
}

/**
 * Parse tool descriptor to UI option format
 */
function parseToolOption(descriptor: MCPToolDescriptor): MCPToolOption {
	return {
		id: descriptor.id,
		name: descriptor.name,
		description: descriptor.description,
		category: descriptor.category,
		tags: descriptor.tags,
		capabilities: descriptor.capabilities,
		isEnabled: descriptor.isEnabled,
	};
}

/**
 * Fetch and manage MCP tools state.
 *
 * @param options.engineId - Optional engine ID to scope tools
 * @param options.insightId - Optional insight ID
 * @param options.fallback - Fallback tools if API fails
 * @param options.autoFetch - Auto-fetch on mount (default: true)
 * @returns Tools state and refetch function
 */
export function useMCPTools({
	engineId,
	insightId,
	fallback = [],
	autoFetch = true,
}: UseMCPToolsOptions = {}): UseMCPToolsReturn {
	const [tools, setTools] = useState<MCPToolOption[]>(fallback);
	const [loading, setLoading] = useState(autoFetch);
	const [error, setError] = useState<Error | null>(null);

	const fetchTools = useCallback(async () => {
		let cancelled = false;

		try {
			setLoading(true);
			setError(null);

			const result = await getMCPTools(engineId, insightId);

			if (!cancelled) {
				setTools(result.map(parseToolOption));
			}
		} catch (e) {
			console.error("Failed to fetch MCP tools:", e);
			if (!cancelled) {
				setError(e as Error);
				setTools(fallback);
			}
		} finally {
			if (!cancelled) {
				setLoading(false);
			}
		}

		return () => {
			cancelled = true;
		};
	}, [engineId, insightId, fallback]);

	useEffect(() => {
		if (autoFetch) {
			let cleanup: (() => void) | undefined;
			fetchTools().then((fn) => {
				cleanup = fn;
			});
			return () => {
				if (cleanup) cleanup();
			};
		}
	}, [autoFetch, fetchTools]);

	return { tools, loading, error, refetch: fetchTools };
}
