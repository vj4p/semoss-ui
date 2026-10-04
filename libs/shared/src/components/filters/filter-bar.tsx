import { SearchIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import {
	Button,
	Checkbox,
	Input,
	Label,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@semoss/ui/next";
import { useDebouncedValue } from "../../hooks/use-debounced-value";

export interface CategoryOption {
	id: string;
	label: string;
	icon?: ReactNode;
	count?: number;
}

export interface TagOption {
	id: string;
	label: string;
	count?: number;
}

export interface SortOption {
	id: string;
	label: string;
	icon?: ReactNode;
}

export interface FilterBarProps {
	// Search
	searchQuery: string;
	onSearchChange: (query: string) => void;
	searchPlaceholder?: string;

	// Categories
	categories: CategoryOption[];
	selectedCategories: string[];
	onCategoryChange: (categories: string[]) => void;

	// Tags (optional)
	tags?: TagOption[];
	selectedTags?: string[];
	onTagChange?: (tags: string[]) => void;

	// Sort
	sortOptions: SortOption[];
	sortBy: string;
	onSortChange: (sort: string) => void;

	// Toggles (optional)
	showOnlyEnabled?: boolean;
	onShowOnlyEnabledChange?: (enabled: boolean) => void;

	// Layout
	compact?: boolean;
}

/**
 * Reusable filter bar component with search, categories, tags, sort, and toggles.
 * Debounces search input at 300ms.
 */
export function FilterBar({
	searchQuery,
	onSearchChange,
	searchPlaceholder = "Search...",
	categories,
	selectedCategories,
	onCategoryChange,
	tags,
	selectedTags = [],
	onTagChange,
	sortOptions,
	sortBy,
	onSortChange,
	showOnlyEnabled,
	onShowOnlyEnabledChange,
	compact = true,
}: FilterBarProps) {
	const [localSearch, setLocalSearch] = useState(searchQuery);
	const debouncedSearch = useDebouncedValue(localSearch, 300);
	const enabledCheckboxId = useId();

	// Sync debounced value to parent
	if (debouncedSearch !== searchQuery) {
		onSearchChange(debouncedSearch);
	}

	const handleCategoryToggle = (categoryId: string) => {
		if (selectedCategories.includes(categoryId)) {
			onCategoryChange(
				selectedCategories.filter((id) => id !== categoryId),
			);
		} else {
			onCategoryChange([...selectedCategories, categoryId]);
		}
	};

	const handleTagToggle = (tagId: string) => {
		if (!onTagChange) return;

		if (selectedTags.includes(tagId)) {
			onTagChange(selectedTags.filter((id) => id !== tagId));
		} else {
			onTagChange([...selectedTags, tagId]);
		}
	};

	const selectedCategoryCount = selectedCategories.length;
	const selectedTagCount = selectedTags.length;

	return (
		<div
			className={
				compact
					? "flex flex-wrap items-center gap-2"
					: "flex flex-col gap-2"
			}
		>
			{/* Search */}
			<div className="relative min-w-[200px] flex-1">
				<SearchIcon className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
				<Input
					type="text"
					value={localSearch}
					onChange={(e) => setLocalSearch(e.target.value)}
					placeholder={searchPlaceholder}
					className="pl-9"
				/>
			</div>

			{/* Category Filter */}
			<Popover>
				<PopoverTrigger asChild>
					<Button variant="outline" className="gap-2">
						Category
						{selectedCategoryCount > 0 && (
							<span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground text-xs">
								{selectedCategoryCount}
							</span>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-56">
					<div className="space-y-2">
						<h4 className="font-medium text-sm">Categories</h4>
						{categories.map((category) => (
							<div
								key={category.id}
								className="flex items-center gap-2"
							>
								<Checkbox
									id={`cat-${category.id}`}
									checked={selectedCategories.includes(
										category.id,
									)}
									onCheckedChange={() =>
										handleCategoryToggle(category.id)
									}
								/>
								<Label
									htmlFor={`cat-${category.id}`}
									className="flex flex-1 cursor-pointer items-center gap-2 text-sm"
								>
									{category.icon}
									{category.label}
									{category.count !== undefined && (
										<span className="ml-auto text-muted-foreground text-xs">
											{category.count}
										</span>
									)}
								</Label>
							</div>
						))}
					</div>
				</PopoverContent>
			</Popover>

			{/* Tag Filter (optional) */}
			{tags && tags.length > 0 && onTagChange && (
				<Popover>
					<PopoverTrigger asChild>
						<Button variant="outline" className="gap-2">
							Tags
							{selectedTagCount > 0 && (
								<span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground text-xs">
									{selectedTagCount}
								</span>
							)}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-56">
						<div className="space-y-2">
							<h4 className="font-medium text-sm">Tags</h4>
							{tags.map((tag) => (
								<div
									key={tag.id}
									className="flex items-center gap-2"
								>
									<Checkbox
										id={`tag-${tag.id}`}
										checked={selectedTags.includes(tag.id)}
										onCheckedChange={() =>
											handleTagToggle(tag.id)
										}
									/>
									<Label
										htmlFor={`tag-${tag.id}`}
										className="flex flex-1 cursor-pointer items-center gap-2 text-sm"
									>
										{tag.label}
										{tag.count !== undefined && (
											<span className="ml-auto text-muted-foreground text-xs">
												{tag.count}
											</span>
										)}
									</Label>
								</div>
							))}
						</div>
					</PopoverContent>
				</Popover>
			)}

			{/* Sort */}
			<Select value={sortBy} onValueChange={onSortChange}>
				<SelectTrigger className="w-[180px]">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{sortOptions.map((option) => (
						<SelectItem key={option.id} value={option.id}>
							<div className="flex items-center gap-2">
								{option.icon}
								{option.label}
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			{/* Show Only Enabled Toggle (optional) */}
			{showOnlyEnabled !== undefined && onShowOnlyEnabledChange && (
				<div className="flex items-center gap-2">
					<Checkbox
						id={enabledCheckboxId}
						checked={showOnlyEnabled}
						onCheckedChange={onShowOnlyEnabledChange}
					/>
					<Label
						htmlFor={enabledCheckboxId}
						className="cursor-pointer text-sm"
					>
						Enabled
					</Label>
				</div>
			)}
		</div>
	);
}
