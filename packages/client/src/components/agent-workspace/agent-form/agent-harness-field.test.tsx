import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { expect, test } from "vitest";
import "@testing-library/jest-dom";
import type { AgentFormValues } from "./types";
import { AGENT_FORM_DEFAULT_VALUES } from "./types";

const { AgentHarnessField } = await import("./agent-harness-field");

function Harness({
	initial = AGENT_FORM_DEFAULT_VALUES,
}: {
	initial?: AgentFormValues;
}) {
	const { control } = useForm<AgentFormValues>({ defaultValues: initial });
	return <AgentHarnessField control={control} />;
}

test("defaults to the SEMOSS Agent placeholder when unset", () => {
	render(<Harness />);
	expect(screen.getByText("SEMOSS Agent (default)")).toBeInTheDocument();
});

test("shows the stored value when the workspace already has one", () => {
	render(
		<Harness
			initial={{
				...AGENT_FORM_DEFAULT_VALUES,
				harnessType: "claude_code",
			}}
		/>,
	);
	expect(screen.getByText("Claude Code")).toBeInTheDocument();
});
