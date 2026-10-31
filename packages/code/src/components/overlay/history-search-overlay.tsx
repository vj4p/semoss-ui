import { useEffect, useId, useRef, useState } from "react";
import type { Session } from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";
import { Input, Muted } from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";
import { OverlayEmpty } from "./overlay-empty";

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
	const { t } = useTranslation("code");
	const listId = useId();
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [items, setItems] = useState<HistoryItem[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const optionId = (index: number): string => `${listId}-option-${index}`;

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

		// The dialog's own auto-focus is off (see OverlayContainer), so focus the search
		const focusTimer = setTimeout(() => inputRef.current?.focus(), 0);
		return () => clearTimeout(focusTimer);
	}, [open, session]);

	// Filter items based on query
	const filteredItems = items.filter((item) => {
		if (!query) return true;
		const lowerQuery = query.toLowerCase();
		return item.text.toLowerCase().includes(lowerQuery);
	});

	/** Hands the chosen entry to the prompt and closes the overlay. */
	const choose = (text: string): void => {
		onSelect(text);
		onDismiss();
	};

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
					choose(filteredItems[selectedIndex].text);
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
			selectedElement.scrollIntoView({ block: "nearest" });
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
				<mark className="bg-warning text-foreground">
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
			title={t("overlay.history.title")}
		>
			<div className="flex flex-col gap-4">
				{/* Search input */}
				<div className="sticky top-0 bg-background pb-4">
					<Input
						ref={inputRef}
						type="text"
						role="combobox"
						aria-expanded={filteredItems.length > 0}
						aria-controls={listId}
						aria-autocomplete="list"
						aria-activedescendant={
							filteredItems.length > 0
								? optionId(selectedIndex)
								: undefined
						}
						aria-describedby={`${listId}-hint`}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={t("overlay.history.searchPlaceholder")}
						aria-label={t("overlay.history.searchLabel")}
						className="font-mono"
					/>
					<div className="mt-2 flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs">
						<output>
							{t("overlay.history.count", {
								total: filteredItems.length,
							})}
						</output>
						<span aria-hidden="true">•</span>
						<span id={`${listId}-hint`}>
							{t("overlay.history.hint")}
						</span>
					</div>
				</div>

				{/* Results list */}
				{filteredItems.length === 0 ? (
					<OverlayEmpty
						title={
							query
								? t("overlay.history.noMatchTitle")
								: t("overlay.history.emptyTitle")
						}
						description={
							query
								? t("overlay.history.noMatchHint")
								: t("overlay.history.emptyHint")
						}
					/>
				) : (
					<div
						ref={listRef}
						id={listId}
						role="listbox"
						aria-label={t("overlay.history.title")}
						className="flex flex-col gap-1"
					>
						{filteredItems.map((item, index) => (
							<div
								key={`${item.text}-${index}`}
								id={optionId(index)}
								role="option"
								tabIndex={-1}
								aria-selected={index === selectedIndex}
								onClick={() => choose(item.text)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										choose(item.text);
									}
								}}
								className={`flex cursor-pointer items-start gap-3 rounded px-3 py-2 text-left transition-colors ${
									index === selectedIndex
										? "bg-accent text-accent-foreground"
										: "hover:bg-accent/50"
								}`}
							>
								<Muted
									className={`mt-0.5 rounded px-1.5 py-0.5 font-mono text-xs ${
										item.type === "command"
											? "bg-info-tint text-info"
											: "bg-success-tint text-success"
									}`}
								>
									{item.type === "command"
										? t("overlay.history.command")
										: t("overlay.history.prompt")}
								</Muted>
								{/* dir=auto: an entry is a command (":help", left-to-right) or a prompt in any language */}
								<span
									dir="auto"
									className="min-w-0 flex-1 truncate font-mono text-sm"
								>
									{highlightMatch(item.text, query)}
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		</OverlayContainer>
	);
};
