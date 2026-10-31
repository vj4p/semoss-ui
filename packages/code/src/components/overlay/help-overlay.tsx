import { useMemo, useState } from "react";
import type { KeyBinding, Platform, Session } from "@semoss/agent-core";
import { Trans, useTranslation } from "@semoss/i18n";
import { Input } from "@semoss/ui/next";
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
	category: CommandCategory;
}

interface KeyItem {
	keys: string;
	action: string;
	description: string;
}

/** The command groups in display order; each has a `overlay.help.categories.*` label. */
const COMMAND_CATEGORIES = [
	"control",
	"navigation",
	"information",
	"session",
] as const;

type CommandCategory = (typeof COMMAND_CATEGORIES)[number];

const COMMAND_CATEGORY_MAP: Record<string, CommandCategory> = {
	help: "information",
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
	files: "information",
	diff: "information",
	runs: "information",
	packs: "information",
	cost: "information",
	inbox: "information",
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
	const { t } = useTranslation("code");
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
					category: COMMAND_CATEGORY_MAP[spec.name] ?? "session",
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
				t(`overlay.help.categories.${cmd.category}`)
					.toLowerCase()
					.includes(lowerQuery),
		);
	}, [commands, query, t]);

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
		const grouped: Record<CommandCategory, CommandItem[]> = {
			control: [],
			navigation: [],
			information: [],
			session: [],
		};
		for (const cmd of filteredCommands) {
			grouped[cmd.category].push(cmd);
		}
		return grouped;
	}, [filteredCommands]);

	return (
		<OverlayContainer
			open={open}
			onDismiss={onDismiss}
			title={t("overlay.help.title")}
		>
			<div className="flex flex-col gap-4">
				{/* Search input */}
				<div className="sticky top-0 bg-background pb-4">
					<Input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t("overlay.help.searchPlaceholder")}
						aria-label={t("overlay.help.searchLabel")}
						className="font-mono"
					/>
					{query ? (
						<output className="mt-2 block text-muted-foreground text-xs">
							{filteredCommands.length === 0 &&
							filteredKeys.length === 0
								? t("overlay.help.noMatches", { query })
								: t("overlay.help.matches", {
										commands: filteredCommands.length,
										shortcuts: filteredKeys.length,
									})}
						</output>
					) : null}
				</div>

				{/* Commands section */}
				<div className="space-y-4">
					<h2 className="font-mono font-semibold text-lg">
						{t("overlay.help.commands")}
					</h2>
					{COMMAND_CATEGORIES.map((key) => {
						const categoryCommands = commandsByCategory[key];
						if (categoryCommands.length === 0 && query) return null;

						return (
							<div key={key} className="space-y-2">
								<h3 className="font-medium font-mono text-muted-foreground text-sm">
									{t(`overlay.help.categories.${key}`)}
								</h3>
								<div className="space-y-1 ps-4">
									{categoryCommands.map((cmd) => (
										<div
											key={cmd.name}
											className="flex flex-col gap-1 rounded p-2 hover:bg-accent/50"
										>
											<code
												dir="ltr"
												className="font-mono text-sm"
											>
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
							{t("overlay.help.shortcuts")}
						</h2>
						<div className="space-y-1 ps-4">
							{filteredKeys.map((key) => (
								<div
									key={key.action}
									className="flex items-start justify-between gap-4 rounded p-2 hover:bg-accent/50"
								>
									<kbd
										dir="ltr"
										className="rounded border bg-muted px-2 py-1 font-mono text-xs"
									>
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
				<div className="mt-4 rounded border border-info bg-info-tint p-3">
					<p className="font-mono text-info text-xs">
						<Trans
							t={t}
							i18nKey="overlay.help.tip"
							components={{ strong: <strong /> }}
						/>
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
