import { useEffect, useRef, useState } from "react";
import type { Session } from "@semoss/agent-core";
import { OverlayContainer } from "./overlay-container";

export interface HistorySearchOverlayProps {
	open: boolean;
	onDismiss: () => void;
	onSelect: (text: string) => void;
	session: Session | null;
}

interface HistoryItem {
	text: string;
	timestamp: number;
	type: "prompt" | "command";
}

/**
 * The Ctrl+R history search overlay — fuzzy search through command and prompt
 * history with keyboard navigation. Phase 6a.
 */
export const HistorySearchOverlay = ({
	open,
	onDismiss,
	onSelect,
	session,
}: HistorySearchOverlayProps) => {
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [items, setItems] = useState<HistoryItem[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	// Load history when overlay opens
	useEffect(() => {
		if (!open || !session) {
			return;
		}

		const state = session.getState();
		const historyItems: HistoryItem[] = [];

		// Extract history from session entries (RunEntry and InputEntry)
		for (const entry of state.entries) {
			let text: string | undefined;
			let timestamp: number | undefined;

			if (entry.kind === "run") {
				text = entry.prompt;
				timestamp = entry.startedAt;
			} else if (entry.kind === "input") {
				text = entry.text;
				timestamp = Date.now(); // InputEntry doesn't have timestamp
			}

			if (text?.trim()) {
				const isCommand = text.startsWith(":");
				historyItems.push({
					text,
					timestamp: timestamp ?? Date.now(),
					type: isCommand ? "command" : "prompt",
				});
			}
		}

		// Reverse to show most recent first
		historyItems.reverse();

		setItems(historyItems);
		setQuery("");
		setSelectedIndex(0);

		// Focus input when overlay opens
		setTimeout(() => inputRef.current?.focus(), 0);
	}, [open, session]);

	// Filter items based on query
	const filteredItems = items.filter((item) => {
		if (!query) return true;
		const lowerQuery = query.toLowerCase();
		return item.text.toLowerCase().includes(lowerQuery);
	});

	// Handle keyboard navigation
	const handleKeyDown = (e: React.KeyboardEvent) => {
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setSelectedIndex((prev) =>
					Math.min(prev + 1, filteredItems.length - 1),
				);
				break;
			case "ArrowUp":
				e.preventDefault();
				setSelectedIndex((prev) => Math.max(prev - 1, 0));
				break;
			case "Enter":
				e.preventDefault();
				if (filteredItems[selectedIndex]) {
					onSelect(filteredItems[selectedIndex].text);
					onDismiss();
				}
				break;
			case "Escape":
				e.preventDefault();
				onDismiss();
				break;
		}
	};

	// Reset selected index when query changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: query triggers the reset
	useEffect(() => {
		setSelectedIndex(0);
	}, [query]);

	// Scroll selected item into view
	useEffect(() => {
		if (!listRef.current) return;
		const selectedElement = listRef.current.children[
			selectedIndex
		] as HTMLElement;
		if (selectedElement) {
			selectedElement.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			});
		}
	}, [selectedIndex]);

	// Highlight matching text
	const highlightMatch = (text: string, query: string) => {
		if (!query) return text;

		const lowerText = text.toLowerCase();
		const lowerQuery = query.toLowerCase();
		const index = lowerText.indexOf(lowerQuery);

		if (index === -1) return text;

		return (
			<>
				{text.slice(0, index)}
				<mark className="bg-yellow-200 text-foreground dark:bg-yellow-900">
					{text.slice(index, index + query.length)}
				</mark>
				{text.slice(index + query.length)}
			</>
		);
	};

	return (
		<OverlayContainer
			open={open}
			onDismiss={onDismiss}
			title="Search History (Ctrl+R)"
		>
			<div className="flex flex-col gap-4">
				{/* Search input */}
				<div className="sticky top-0 bg-background pb-4">
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Type to search command and prompt history..."
						className="w-full rounded border bg-background px-3 py-2 font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
					/>
					<p className="mt-2 text-muted-foreground text-xs">
						{filteredItems.length} item
						{filteredItems.length !== 1 ? "s" : ""} • Use ↑↓ to
						navigate, Enter to select, Esc to close
					</p>
				</div>

				{/* Results list */}
				{filteredItems.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
						<p className="font-mono text-muted-foreground text-sm">
							{query ? "No matching items" : "History is empty"}
						</p>
						<p className="text-muted-foreground text-xs">
							{query
								? "Try a different search term"
								: "Commands and prompts will appear here"}
						</p>
					</div>
				) : (
					<div
						ref={listRef}
						className="flex flex-col gap-1 overflow-y-auto"
						style={{ maxHeight: "calc(100vh - 16rem)" }}
					>
						{filteredItems.map((item, index) => (
							<button
								key={`${item.text}-${index}`}
								type="button"
								onClick={() => {
									onSelect(item.text);
									onDismiss();
								}}
								className={`flex items-start gap-3 rounded px-3 py-2 text-left transition-colors ${
									index === selectedIndex
										? "bg-accent text-accent-foreground"
										: "hover:bg-accent/50"
								}`}
							>
								<span
									className={`mt-0.5 rounded px-1.5 py-0.5 font-mono text-xs ${
										item.type === "command"
											? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
											: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100"
									}`}
								>
									{item.type === "command" ? "cmd" : "prompt"}
								</span>
								<span className="min-w-0 flex-1 truncate font-mono text-sm">
									{highlightMatch(item.text, query)}
								</span>
							</button>
						))}
					</div>
				)}
			</div>
		</OverlayContainer>
	);
};
