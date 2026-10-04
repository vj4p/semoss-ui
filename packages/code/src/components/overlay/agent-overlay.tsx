import { useMemo, useState } from "react";
import type { HarnessOption } from "@semoss/agent-core";
import { FilterBar } from "@semoss/shared";
import { OverlayContainer } from "./overlay-container";

export interface AgentOverlayProps {
	open: boolean;
	onDismiss: () => void;
	harnesses: readonly HarnessOption[];
}

/**
 * The `:agent` overlay — displays harnesses (agents) available in the platform.
 * Provides search and sort filtering for harness discovery. Phase 3.
 */
export const AgentOverlay = ({
	open,
	onDismiss,
	harnesses,
}: AgentOverlayProps) => {
	// Filter state
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState<
		"recommended" | "name-asc" | "name-desc"
	>("recommended");

	// Sort options
	const sortOptions = [
		{ id: "recommended", label: "Recommended" },
		{ id: "name-asc", label: "Name (A-Z)" },
		{ id: "name-desc", label: "Name (Z-A)" },
	];

	// Filter and sort harnesses
	const filteredAndSortedHarnesses = useMemo(() => {
		let result = Array.from(harnesses);

		// Text search
		if (searchQuery) {
			const lower = searchQuery.toLowerCase();
			result = result.filter(
				(h) =>
					h.name.toLowerCase().includes(lower) ||
					h.label.toLowerCase().includes(lower) ||
					(h.description &&
						h.description.toLowerCase().includes(lower)),
			);
		}

		// Sort
		switch (sortBy) {
			case "recommended":
				// Keep original order (backend orders by recommended)
				break;
			case "name-asc":
				result = [...result].sort((a, b) =>
					a.label.localeCompare(b.label),
				);
				break;
			case "name-desc":
				result = [...result].sort((a, b) =>
					b.label.localeCompare(a.label),
				);
				break;
		}

		return result;
	}, [harnesses, searchQuery, sortBy]);

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":agent">
			{harnesses.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono text-muted-foreground text-sm">
						No harnesses available
					</p>
					<p className="text-muted-foreground text-xs">
						Harnesses may be disabled or not yet configured
					</p>
				</div>
			) : (
				<div className="flex h-full flex-col gap-4">
					{/* Filter bar */}
					<div className="border-b">
						<FilterBar
							searchQuery={searchQuery}
							onSearchChange={setSearchQuery}
							searchPlaceholder="Search harnesses..."
							categories={[]}
							selectedCategories={[]}
							onCategoryChange={() => {}}
							sortOptions={sortOptions}
							sortBy={sortBy}
							onSortChange={(s) =>
								setSortBy(
									s as
										| "recommended"
										| "name-asc"
										| "name-desc",
								)
							}
							compact={true}
						/>
					</div>

					{/* Harness count */}
					<div className="flex items-center justify-between border-b pb-2">
						<p className="font-mono text-muted-foreground text-sm">
							{filteredAndSortedHarnesses.length} harness
							{filteredAndSortedHarnesses.length !== 1
								? "es"
								: ""}{" "}
							available
						</p>
					</div>

					{/* Harness list */}
					<div className="flex-1 space-y-3 overflow-y-auto">
						{filteredAndSortedHarnesses.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
								<p className="font-mono text-muted-foreground text-sm">
									No harnesses match your search
								</p>
								<p className="text-muted-foreground text-xs">
									Try adjusting your search terms
								</p>
							</div>
						) : (
							filteredAndSortedHarnesses.map((harness) => (
								<div
									key={harness.name}
									className="flex flex-col gap-2 rounded border p-4 hover:bg-accent/50"
								>
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<h3 className="font-mono font-semibold text-base">
												{harness.label}
											</h3>
											{harness.description && (
												<p className="mt-1 text-muted-foreground text-sm">
													{harness.description}
												</p>
											)}
										</div>
									</div>
									<div className="font-mono text-muted-foreground text-xs">
										<span>{harness.name}</span>
									</div>
								</div>
							))
						)}
					</div>
				</div>
			)}
		</OverlayContainer>
	);
};
