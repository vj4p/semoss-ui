import { Muted } from "@semoss/ui/next";
import { RUN_RESULTS_LAYOUT_CLASSES } from "./run-node-view-state";

/** Pretty-prints stored JSON; anything that is not JSON is shown as it is. */
function formatJson(text: string): string {
	try {
		return JSON.stringify(JSON.parse(text) as unknown, null, 2);
	} catch {
		return text;
	}
}

/** Props for {@link RunInputViewer}. */
interface RunInputViewerProps {
	/** The stored input text; JSON is pretty-printed, anything else shown as it is. */
	runInput: string;
}

/** What the run was started with. */
export function RunInputViewer({ runInput }: RunInputViewerProps) {
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
