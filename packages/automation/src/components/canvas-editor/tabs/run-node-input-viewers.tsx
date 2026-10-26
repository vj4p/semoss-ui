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

/** Pretty-prints stored JSON; anything that is not JSON is shown as it is. */
function formatJson(text: string): string {
	try {
		return JSON.stringify(JSON.parse(text) as unknown, null, 2);
	} catch {
		return text;
	}
}

/** What the run was started with. */
export function RunInputViewer({ runInput }: { runInput: string }) {
	return (
		<div className="space-y-2">
			<Muted>
				What this run was started with. Values whose names mark them as
				secrets are hidden.
			</Muted>
			<section
				// the region scrolls, so it must be reachable by keyboard
				// biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region
				tabIndex={0}
				aria-label="Run input"
				className={RUN_RESULTS_LAYOUT_CLASSES.scrollRegion}
			>
				<pre className="whitespace-pre-wrap break-words bg-muted/30 p-3 font-mono text-xs">
					{formatJson(runInput)}
				</pre>
			</section>
		</div>
	);
}

/** What one step could read when it started. */
export function RunStepVariablesViewer({
	variables,
	omitted = 0,
}: {
	variables: AutomationStepVariable[];
	omitted?: number;
}) {
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
