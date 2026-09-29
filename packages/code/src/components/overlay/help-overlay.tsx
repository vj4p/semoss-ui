import { useMemo, useState } from "react";
import type { KeyBinding, Platform, Session } from "@semoss/agent-core";
import { OverlayContainer } from "./overlay-container";

export interface HelpOverlayProps {
	open: boolean;
	onDismiss: () => void;
	session: Session | null;
	keymap: readonly KeyBinding[];
	platform?: Platform;
}

interface CommandItem {
	name: string;
	usage: string;
	description: string;
	category: string;
}

interface KeyItem {
	keys: string;
	action: string;
	description: string;
}

const COMMAND_CATEGORIES = {
	control: "Control",
	navigation: "Navigation",
	overlays: "Information",
	session: "Session",
} as const;

const COMMAND_CATEGORY_MAP: Record<string, keyof typeof COMMAND_CATEGORIES> = {
	help: "overlays",
	harness: "session",
	model: "session",
	new: "session",
	stop: "control",
	clear: "navigation",
	approve: "control",
	deny: "control",
	edit: "control",
	always: "control",
	allowed: "session",
	revoke: "session",
	files: "overlays",
	diff: "overlays",
	runs: "overlays",
	packs: "overlays",
	cost: "overlays",
	inbox: "overlays",
	export: "session",
};

/**
 * The `:help` overlay — categorized command and keyboard shortcut reference
 * with search/filter capability. Phase 6c.
 */
export const HelpOverlay = ({
	open,
	onDismiss,
	session,
	keymap,
	platform,
}: HelpOverlayProps) => {
	const [query, setQuery] = useState("");

	const { commands, keys } = useMemo(() => {
		if (!session) {
			return { commands: [], keys: [] };
		}

		// Extract commands
		const commandItems: CommandItem[] = session.commands.commands.map(
			(spec) => {
				const usage = spec.args
					? `:${spec.name} ${spec.args
							.map((arg) =>
								arg.optional
									? `[${arg.name}${arg.rest ? "…" : ""}]`
									: `<${arg.name}${arg.rest ? "…" : ""}>`,
							)
							.join(" ")}`
					: `:${spec.name}`;

				const aliases = spec.aliases
					? `, :${spec.aliases.join(", :")}`
					: "";
				const fullUsage = usage + aliases;

				return {
					name: spec.name,
					usage: fullUsage,
					description: session.translate(spec.describe),
					category:
						COMMAND_CATEGORY_MAP[spec.name] ||
						("session" as keyof typeof COMMAND_CATEGORIES),
				};
			},
		);

		// Extract keyboard shortcuts
		// Group by action, show all key combinations
		const keysByAction = new Map<
			string,
			{ keys: string[]; description: string }
		>();

		for (const binding of keymap) {
			const chord = formatChord(binding.chord, platform);
			const existing = keysByAction.get(binding.action);
			if (existing) {
				if (!existing.keys.includes(chord)) {
					existing.keys.push(chord);
				}
			} else {
				keysByAction.set(binding.action, {
					keys: [chord],
					description: session.translate(binding.describe),
				});
			}
		}

		const keyItems: KeyItem[] = Array.from(keysByAction.entries()).map(
			([action, { keys, description }]) => ({
				keys: keys.join(" / "),
				action,
				description,
			}),
		);

		return { commands: commandItems, keys: keyItems };
	}, [session, keymap, platform]);

	// Filter by query
	const filteredCommands = useMemo(() => {
		if (!query) return commands;
		const lowerQuery = query.toLowerCase();
		return commands.filter(
			(cmd) =>
				cmd.name.toLowerCase().includes(lowerQuery) ||
				cmd.description.toLowerCase().includes(lowerQuery) ||
				cmd.category.toLowerCase().includes(lowerQuery),
		);
	}, [commands, query]);

	const filteredKeys = useMemo(() => {
		if (!query) return keys;
		const lowerQuery = query.toLowerCase();
		return keys.filter(
			(key) =>
				key.keys.toLowerCase().includes(lowerQuery) ||
				key.description.toLowerCase().includes(lowerQuery),
		);
	}, [keys, query]);

	// Group commands by category
	const commandsByCategory = useMemo(() => {
		const grouped: Record<string, CommandItem[]> = {};
		for (const cmd of filteredCommands) {
			if (!grouped[cmd.category]) {
				grouped[cmd.category] = [];
			}
			grouped[cmd.category].push(cmd);
		}
		return grouped;
	}, [filteredCommands]);

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title="Help">
			<div className="flex flex-col gap-4">
				{/* Search input */}
				<div className="sticky top-0 bg-background pb-4">
					<input
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search commands and shortcuts..."
						className="w-full rounded border bg-background px-3 py-2 font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
					/>
					{query && (
						<p className="mt-2 text-muted-foreground text-xs">
							{filteredCommands.length} command
							{filteredCommands.length !== 1 ? "s" : ""},{" "}
							{filteredKeys.length} shortcut
							{filteredKeys.length !== 1 ? "s" : ""}
						</p>
					)}
				</div>

				{/* Commands section */}
				<div className="space-y-4">
					<h2 className="font-mono font-semibold text-lg">
						Commands
					</h2>
					{Object.entries(COMMAND_CATEGORIES).map(([key, label]) => {
						const categoryCommands = commandsByCategory[key] || [];
						if (categoryCommands.length === 0 && query) return null;

						return (
							<div key={key} className="space-y-2">
								<h3 className="font-medium font-mono text-muted-foreground text-sm">
									{label}
								</h3>
								<div className="space-y-1 ps-4">
									{categoryCommands.map((cmd) => (
										<div
											key={cmd.name}
											className="flex flex-col gap-1 rounded p-2 hover:bg-accent/50"
										>
											<code className="font-mono text-sm">
												{cmd.usage}
											</code>
											<p className="text-muted-foreground text-xs">
												{cmd.description}
											</p>
										</div>
									))}
								</div>
							</div>
						);
					})}
				</div>

				{/* Keyboard shortcuts section */}
				{filteredKeys.length > 0 && (
					<div className="space-y-2">
						<h2 className="font-mono font-semibold text-lg">
							Keyboard Shortcuts
						</h2>
						<div className="space-y-1 ps-4">
							{filteredKeys.map((key) => (
								<div
									key={key.action}
									className="flex items-start justify-between gap-4 rounded p-2 hover:bg-accent/50"
								>
									<kbd className="rounded border bg-muted px-2 py-1 font-mono text-xs">
										{key.keys}
									</kbd>
									<p className="flex-1 text-muted-foreground text-sm">
										{key.description}
									</p>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Tips */}
				<div className="mt-4 rounded border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
					<p className="font-mono text-blue-900 text-xs dark:text-blue-100">
						<strong>Tip:</strong> Type two colons (::) to send a
						prompt that starts with a colon.
					</p>
				</div>
			</div>
		</OverlayContainer>
	);
};

/**
 * Format a key chord for display, accounting for platform differences.
 */
const formatChord = (
	chord: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean },
	platform?: Platform,
): string => {
	const parts: string[] = [];

	if (chord.ctrl) {
		parts.push(platform === "mac" ? "⌃" : "Ctrl");
	}
	if (chord.alt) {
		parts.push(platform === "mac" ? "⌥" : "Alt");
	}
	if (chord.shift) {
		parts.push(platform === "mac" ? "⇧" : "Shift");
	}

	// Format key name
	const keyName = chord.key === " " ? "Space" : chord.key.toUpperCase();
	parts.push(keyName);

	return parts.join(platform === "mac" ? "" : "+");
};
