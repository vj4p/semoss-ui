import {
	Badge,
	Muted,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@semoss/ui/next";
import type { AutomationStepVariable } from "../../../domain/automation.types";
import { RUN_RESULTS_LAYOUT_CLASSES } from "./run-node-view-state";

/** Props for {@link RunStepVariablesViewer}. */
interface RunStepVariablesViewerProps {
	variables: AutomationStepVariable[];
	/** How many variables the backend dropped to stay within its bound. */
	omitted?: number;
}

/** What one step could read when it started. */
export function RunStepVariablesViewer({
	variables,
	omitted = 0,
}: RunStepVariablesViewerProps) {
	if (variables.length === 0) {
		return <Muted>This step started with no variables.</Muted>;
	}
	return (
		<div className="space-y-2">
			<Muted>
				The variables this step could read when it started. Values are
				shortened, and secret-named values are hidden.
			</Muted>
			<section
				// biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region
				tabIndex={0}
				aria-label="Step variables"
				className={RUN_RESULTS_LAYOUT_CLASSES.scrollRegion}
			>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Value</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{variables.map((variable) => (
							<TableRow key={variable.name}>
								<TableCell className="font-mono text-xs">
									{variable.name}
								</TableCell>
								<TableCell className="text-xs">
									{variable.kind}
								</TableCell>
								<TableCell className="max-w-96 whitespace-pre-wrap break-words font-mono text-xs">
									{variable.redacted ? (
										<Badge variant="secondary">
											Hidden
										</Badge>
									) : variable.value === null ? (
										<span className="text-muted-foreground">
											{variable.truncated
												? "Too large to keep"
												: "Not set"}
										</span>
									) : (
										<>
											{variable.value}
											{variable.truncated ? (
												<span className="text-muted-foreground">
													{" "}
													(shortened)
												</span>
											) : null}
										</>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</section>
			{omitted > 0 ? (
				<Muted>{omitted} more variables were not kept.</Muted>
			) : null}
		</div>
	);
}
