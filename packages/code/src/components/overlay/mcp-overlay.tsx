import { useEffect, useMemo, useState } from "react";
import type { Session } from "@semoss/agent-core";
import {
	type CategoryOption,
	FilterBar,
	type MCPToolOption,
	SelectableCard,
	type SortOption,
	type TagOption,
	useMCPTools,
} from "@semoss/shared";
import { Button, Spinner } from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";

export interface MCPOverlayProps {
	open: boolean;
	onDismiss: () => void;
	session: Session;
}

/**
 * The `:mcp` overlay — manages MCP tool selection for the current room.
 * Provides filtering, multi-select, and persistence via session backend.
 */
export const MCPOverlay = ({ open, onDismiss, session }: MCPOverlayProps) => {
	const { tools, loading, error } = useMCPTools({ autoFetch: open });

	// Local selection state (uncommitted until Apply)
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [applying, setApplying] = useState(false);

	// Filter state
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [sortBy, setSortBy] = useState<string>("name-asc");
	const [showOnlyEnabled, setShowOnlyEnabled] = useState(false);

	// Load initial selection from session
	useEffect(() => {
		if (!open) return;

		const loadEnabledTools = async () => {
			try {
				const enabledTools = await session.getEnabledMCPTools();
				setSelectedIds(new Set(enabledTools));
			} catch (err) {
				console.error("Failed to load enabled tools:", err);
			}
		};

		loadEnabledTools();
	}, [open, session]);

	// Build filter options from tools
	const { categories, tags } = useMemo(() => {
		const categoryMap = new Map<string, number>();
		const tagMap = new Map<string, number>();

		for (const tool of tools) {
			// Count categories
			const category = tool.category || "uncategorized";
			categoryMap.set(category, (categoryMap.get(category) || 0) + 1);

			// Count tags
			for (const tag of tool.tags || []) {
				tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
			}
		}

		return {
			categories: Array.from(categoryMap.entries())
				.map(
					([id, count]): CategoryOption => ({
						id,
						label:
							id.charAt(0).toUpperCase() +
							id.slice(1).toLowerCase(),
						count,
					}),
				)
				.sort((a, b) => a.label.localeCompare(b.label)),
			tags: Array.from(tagMap.entries())
				.map(
					([id, count]): TagOption => ({
						id,
						label: id,
						count,
					}),
				)
				.sort((a, b) => a.label.localeCompare(b.label)),
		};
	}, [tools]);

	const sortOptions: SortOption[] = [
		{ id: "name-asc", label: "Name (A-Z)" },
		{ id: "name-desc", label: "Name (Z-A)" },
		{ id: "category", label: "Category" },
	];

	// Filter and sort tools
	const filteredTools = useMemo(() => {
		let filtered = tools;

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(tool: MCPToolOption) =>
					tool.name.toLowerCase().includes(query) ||
					tool.description?.toLowerCase().includes(query) ||
					tool.category?.toLowerCase().includes(query),
			);
		}

		// Category filter
		if (selectedCategories.length > 0) {
			filtered = filtered.filter((tool: MCPToolOption) =>
				selectedCategories.includes(tool.category || "uncategorized"),
			);
		}

		// Tag filter
		if (selectedTags.length > 0) {
			filtered = filtered.filter((tool: MCPToolOption) =>
				tool.tags?.some((tag: string) => selectedTags.includes(tag)),
			);
		}

		// Enabled filter
		if (showOnlyEnabled) {
			filtered = filtered.filter((tool: MCPToolOption) => tool.isEnabled);
		}

		// Sort
		const sorted = [...filtered];
		switch (sortBy) {
			case "name-asc":
				sorted.sort((a, b) => a.name.localeCompare(b.name));
				break;
			case "name-desc":
				sorted.sort((a, b) => b.name.localeCompare(a.name));
				break;
			case "category":
				sorted.sort((a, b) => {
					const catA = a.category || "uncategorized";
					const catB = b.category || "uncategorized";
					return (
						catA.localeCompare(catB) || a.name.localeCompare(b.name)
					);
				});
				break;
		}

		return sorted;
	}, [
		tools,
		searchQuery,
		selectedCategories,
		selectedTags,
		showOnlyEnabled,
		sortBy,
	]);

	const handleSelect = (id: string, selected: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (selected) {
				next.add(id);
			} else {
				next.delete(id);
			}
			return next;
		});
	};

	const handleApply = async () => {
		setApplying(true);
		try {
			await session.setMCPTools(Array.from(selectedIds));
			onDismiss();
		} catch (err) {
			console.error("Failed to apply MCP tool selection:", err);
			// TODO: Show error toast
		} finally {
			setApplying(false);
		}
	};

	const handleCancel = () => {
		onDismiss();
	};

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":mcp">
			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Spinner />
				</div>
			) : error ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono text-red-600 text-sm dark:text-red-400">
						{error.message}
					</p>
					<p className="text-muted-foreground text-xs">
						Unable to load MCP tools
					</p>
				</div>
			) : tools.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono text-muted-foreground text-sm">
						No MCP tools available
					</p>
					<p className="text-muted-foreground text-xs">
						MCP tools may be disabled or not yet configured
					</p>
				</div>
			) : (
				<div className="flex h-full flex-col gap-4">
					{/* Filter bar */}
					<FilterBar
						searchQuery={searchQuery}
						onSearchChange={setSearchQuery}
						searchPlaceholder="Search tools..."
						categories={categories}
						selectedCategories={selectedCategories}
						onCategoryChange={setSelectedCategories}
						tags={tags}
						selectedTags={selectedTags}
						onTagChange={setSelectedTags}
						sortOptions={sortOptions}
						sortBy={sortBy}
						onSortChange={setSortBy}
						showOnlyEnabled={showOnlyEnabled}
						onShowOnlyEnabledChange={setShowOnlyEnabled}
						compact={true}
					/>

					{/* Tool count and selection summary */}
					<div className="flex items-center justify-between border-b pb-2">
						<p className="font-mono text-muted-foreground text-sm">
							{filteredTools.length} tool
							{filteredTools.length !== 1 ? "s" : ""} available
						</p>
						<p className="font-mono text-sm">
							{selectedIds.size} selected
						</p>
					</div>

					{/* Tool cards */}
					<div className="flex-1 space-y-2 overflow-y-auto">
						{filteredTools.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
								<p className="font-mono text-muted-foreground text-sm">
									No tools match your filters
								</p>
								<p className="text-muted-foreground text-xs">
									Try adjusting your search or filters
								</p>
							</div>
						) : (
							filteredTools.map((tool) => (
								<SelectableCard
									key={tool.id}
									id={tool.id}
									title={tool.name}
									description={
										tool.description || "No description"
									}
									selected={selectedIds.has(tool.id)}
									multiSelect={true}
									onSelect={handleSelect}
									badges={
										tool.category
											? [
													{
														label: tool.category,
														variant: "default",
													},
												]
											: []
									}
									metadata={
										tool.tags && tool.tags.length > 0 ? (
											<div className="flex flex-wrap gap-1">
												{tool.tags.map(
													(tag: string) => (
														<span
															key={tag}
															className="rounded-sm bg-accent px-1.5 py-0.5 font-mono text-muted-foreground text-xs"
														>
															{tag}
														</span>
													),
												)}
											</div>
										) : undefined
									}
								/>
							))
						)}
					</div>

					{/* Action buttons */}
					<div className="flex items-center justify-end gap-2 border-t pt-3">
						<Button
							variant="outline"
							onClick={handleCancel}
							disabled={applying}
						>
							Cancel
						</Button>
						<Button onClick={handleApply} disabled={applying}>
							{applying ? "Applying..." : "Apply"}
						</Button>
					</div>
				</div>
			)}
		</OverlayContainer>
	);
};
