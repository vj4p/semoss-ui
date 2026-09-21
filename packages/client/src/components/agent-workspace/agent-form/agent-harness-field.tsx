import { useId } from "react";
import { type Control, Controller } from "react-hook-form";
import { useAgentHarnesses } from "@semoss/shared";
import {
	Field,
	FieldLabel,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@semoss/ui/next";
import type { AgentFormValues } from "./types";

export interface AgentHarnessFieldProps {
	control: Control<AgentFormValues>;
}

/**
 * Offered if the backend cannot be reached. Mirrors what this picker listed when
 * the list was hardcoded, so a failed call degrades to the previous behaviour
 * rather than to an empty select. Which harnesses are actually offered is the
 * backend's call now - see IAgentHarness.isSelectable.
 */
const FALLBACK_HARNESSES = [
	{ name: "semoss", label: "SEMOSS Agent" },
	{ name: "claude_code", label: "Claude Code" },
] as const;

export const AgentHarnessField = ({ control }: AgentHarnessFieldProps) => {
	const fieldId = useId();
	const { harnesses } = useAgentHarnesses({
		fallback: FALLBACK_HARNESSES,
	});

	return (
		<Controller
			name="harnessType"
			control={control}
			render={({ field }) => (
				<Field>
					<FieldLabel htmlFor={fieldId}>Agent engine</FieldLabel>
					<Select value={field.value} onValueChange={field.onChange}>
						<SelectTrigger id={fieldId}>
							<SelectValue placeholder="SEMOSS Agent (default)" />
						</SelectTrigger>
						<SelectContent>
							{harnesses.map((harness) => (
								<SelectItem
									key={harness.name}
									value={harness.name}
								>
									{harness.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			)}
		/>
	);
};
