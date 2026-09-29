import { useMemo } from "react";
import type {
	CompletionContext,
	CompletionItem,
	CompletionResult,
	Session,
} from "@semoss/agent-core";
import {
	filterCompletions,
	getCompletionRange,
	parseCommandContext,
} from "@semoss/agent-core";

/**
 * Provides Tab completion for the prompt input based on session state.
 *
 * Completes:
 * - Command names after `:`
 * - Harness names after `:harness `
 * - Model names/IDs after `:model `
 * - Tool names after `:revoke `
 */
export const useCompletions = (session: Session | null) => {
	const complete = useMemo(() => {
		if (!session) {
			return () => undefined;
		}

		return (context: CompletionContext): CompletionResult | undefined => {
			const { text, position } = context;
			const { command, prefix } = parseCommandContext(text, position);

			// Get available items based on context
			let items: CompletionItem[] = [];

			if (command === undefined) {
				// Completing command name
				items = session.commands.commands.map((spec) => ({
					value: spec.name,
					label: spec.name,
					description: session.translate(spec.describe),
					kind: "command",
				}));
			} else if (command === "harness") {
				// Completing harness name
				const state = session.getState();
				items = state.catalog.harnesses.map((h) => ({
					value: h.name,
					label: h.label,
					description: h.name,
					kind: "harness",
				}));
			} else if (command === "model") {
				// Completing model name or ID
				const state = session.getState();
				items = state.catalog.models.map((m) => ({
					value: m.id,
					label: m.name,
					description: m.id,
					kind: "model",
				}));
			} else if (command === "revoke") {
				// Completing tool name
				const state = session.getState();
				items = state.alwaysAllowed.map((tool) => ({
					value: tool.label,
					label: tool.label,
					description: tool.toolName,
					kind: "tool",
				}));
			}

			// Filter by prefix
			const filtered = filterCompletions(items, prefix);

			if (filtered.length === 0) {
				return undefined;
			}

			// Calculate replacement range
			const range = getCompletionRange(text, position);

			return {
				items: filtered,
				range,
			};
		};
	}, [session]);

	return complete;
};
