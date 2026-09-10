import { useId } from "react";
import { type Control, Controller } from "react-hook-form";
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

/** SEMOSS-registered harness names this picker exposes (AgentHarnessRegistry has a 3rd, "github_copilot_py", not surfaced here). */
const HARNESS_OPTIONS = [
	{ value: "semoss", label: "SEMOSS Agent" },
	{ value: "claude_code", label: "Claude Code" },
];

export const AgentHarnessField = ({ control }: AgentHarnessFieldProps) => {
	const fieldId = useId();

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
							{HARNESS_OPTIONS.map((option) => (
								<SelectItem
									key={option.value}
									value={option.value}
								>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			)}
		/>
	);
};
