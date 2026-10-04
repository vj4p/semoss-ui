import { useCallback, useEffect, useRef, useState } from "react";
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

	const cancelledRef = useRef(false);
	const fallbackRef = useRef(fallback);

	// Keep fallback ref in sync with prop
	useEffect(() => {
		fallbackRef.current = fallback;
	}, [fallback]);

	const fetchTools = useCallback(async () => {
		cancelledRef.current = false;

		try {
			setLoading(true);
			setError(null);

			const result = await getMCPTools(engineId, insightId);

			if (!cancelledRef.current) {
				setTools(result.map(parseToolOption));
			}
		} catch (e) {
			console.error("Failed to fetch MCP tools:", e);
			if (!cancelledRef.current) {
				setError(e as Error);
				setTools(fallbackRef.current);
			}
		} finally {
			if (!cancelledRef.current) {
				setLoading(false);
			}
		}
	}, [engineId, insightId]);

	useEffect(() => {
		if (autoFetch) {
			fetchTools();
			return () => {
				cancelledRef.current = true;
			};
		}
	}, [autoFetch, fetchTools]);

	return { tools, loading, error, refetch: fetchTools };
}
