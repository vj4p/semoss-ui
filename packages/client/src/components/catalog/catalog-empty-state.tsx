import { Button, H3, P } from "@semoss/ui/next";

export interface CatalogEmptyStateProps {
	/** What the catalog lists, plural and lower case, such as "agents" */
	noun: string;
	/** Whether a search or a filter is narrowing the list */
	filtered: boolean;
	/** The tab the empty list is on */
	view: "mine" | "discoverable";
	/** Clear the search and every filter */
	onClear: () => void;
	/** Switch to the discoverable tab; omit where there is no such tab */
	onBrowseDiscoverable?: () => void;
}

/**
 * What a catalog shows when it has nothing to list. A list narrowed by a search
 * or filter says so and offers to clear it; a list that is empty on its own
 * says what will appear and where to look.
 */
export const CatalogEmptyState = ({
	noun,
	filtered,
	view,
	onClear,
	onBrowseDiscoverable,
}: CatalogEmptyStateProps) => {
	let title: string;
	let description: string;
	if (filtered) {
		title = `No ${noun} match`;
		description = "Try a different search, or remove a filter.";
	} else if (view === "mine") {
		title = `No ${noun} yet`;
		description = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} you create or are given access to appear here.`;
	} else {
		title = `Nothing discoverable yet`;
		description = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} that others make discoverable appear here.`;
	}

	return (
		<output className="flex w-full flex-col items-center gap-2 px-2 py-12 text-center">
			<H3 className="text-xl">{title}</H3>
			<P className="max-w-prose text-muted-foreground text-sm">
				{description}
			</P>
			<div className="mt-2 flex flex-wrap items-center justify-center gap-2">
				{filtered ? (
					<Button variant="outline" size="sm" onClick={onClear}>
						Clear search and filters
					</Button>
				) : null}
				{!filtered && view === "mine" && onBrowseDiscoverable ? (
					<Button
						variant="outline"
						size="sm"
						onClick={onBrowseDiscoverable}
					>
						Browse discoverable {noun}
					</Button>
				) : null}
			</div>
		</output>
	);
};
