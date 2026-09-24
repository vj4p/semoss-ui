/**
 * The console's built-in commands.
 *
 * Each one is a thin call into the {@link Session}, where the behaviour lives,
 * so a button in the web host and a command typed at the prompt cannot come to
 * differ. What is left here is what only a command has: its name, its
 * arguments, and the listings `:help`, `:harness` and `:model` print.
 *
 * The listings pad their columns with spaces, which lines up in the monospace
 * type both hosts draw a console in.
 */

import { type CommandSpec, formatUsage } from "../commands/registry";
import { chordLabel, type KeyBinding, type Platform } from "../keymap/keymap";
import { type Line, type Segment, textLine } from "../transcript/line";
import type { Session } from "./session";

export interface SessionCommandOptions {
	keymap: readonly KeyBinding[];
	platform?: Platform;
	/** Whether the host can save an export. Without it `:export` is left out, rather than offered and then failing. */
	canExport: boolean;
}

const INDENT = "  ";
const GUTTER = "  ";

/** Rows of a two-column table: the first column as code, padded to one width. */
const table = (
	rows: readonly { key: string; rest: readonly Segment[] }[],
): Line[] => {
	const width = Math.max(0, ...rows.map((row) => row.key.length));
	return rows.map((row) => ({
		kind: "text",
		segments: [
			{ text: INDENT },
			{ text: row.key, emphasis: "code" },
			{ text: " ".repeat(width - row.key.length) + GUTTER },
			...row.rest,
		],
	}));
};

const usageWithAliases = (spec: CommandSpec<Session>) =>
	[
		formatUsage(spec),
		...(spec.aliases ?? []).map((alias) => `:${alias}`),
	].join(", ");

const helpLines = (
	session: Session,
	keymap: readonly KeyBinding[],
	platform: Platform | undefined,
): Line[] => {
	const { translate } = session;

	// One row per action, listing every chord that performs it, in the
	// keymap's order.
	const keys = new Map<string, { chords: string[]; binding: KeyBinding }>();
	for (const binding of keymap) {
		const chord = chordLabel(binding.chord, platform);
		const row = keys.get(binding.action);
		if (row === undefined) {
			keys.set(binding.action, { chords: [chord], binding });
		} else if (!row.chords.includes(chord)) {
			row.chords.push(chord);
		}
	}

	return [
		textLine(translate("help.commands"), "bold"),
		...table(
			session.commands.commands.map((spec) => ({
				key: usageWithAliases(spec),
				rest: [{ text: translate(spec.describe) }],
			})),
		),
		textLine(translate("help.literalColon"), "dim"),
		textLine(translate("help.keys"), "bold"),
		...table(
			[...keys.values()].map(({ chords, binding }) => ({
				key: chords.join(" / "),
				rest: [{ text: translate(binding.describe) }],
			})),
		),
	];
};

const current = (session: Session): Segment => ({
	text: `${GUTTER}${session.translate("session.current")}`,
	emphasis: "accent",
});

const harnessLines = (session: Session): Line[] => {
	const { translate } = session;
	const { catalog, harness } = session.getState();
	if (catalog.harnesses.length === 0) {
		return [textLine(translate("session.noHarness"), "error")];
	}
	return [
		textLine(translate("session.harnessList"), "bold"),
		...table(
			catalog.harnesses.map((option) => ({
				key: option.name,
				rest: [
					{ text: option.label },
					...(option.name === harness ? [current(session)] : []),
				],
			})),
		),
		textLine(translate("session.switchHarnessHint"), "dim"),
	];
};

const modelLines = (session: Session): Line[] => {
	const { translate } = session;
	const { catalog, modelId } = session.getState();
	if (catalog.models.length === 0) {
		return [textLine(translate("session.noModel"), "error")];
	}
	return [
		textLine(translate("session.modelList"), "bold"),
		...table(
			catalog.models.map((model) => ({
				key: model.name,
				rest: [
					{ text: model.id, emphasis: "dim" },
					...(model.id === modelId ? [current(session)] : []),
				],
			})),
		),
		textLine(translate("session.switchModelHint"), "dim"),
	];
};

export const createSessionCommands = ({
	keymap,
	platform,
	canExport,
}: SessionCommandOptions): CommandSpec<Session>[] => [
	{
		name: "help",
		describe: "command.help",
		run: (session) => session.notice(helpLines(session, keymap, platform)),
	},
	{
		name: "harness",
		args: [{ name: "name", optional: true, rest: true }],
		describe: "command.harness",
		run: async (session, { rest }) => {
			if (rest === "") {
				session.notice(harnessLines(session));
			} else {
				await session.setHarness(rest);
			}
		},
	},
	{
		name: "model",
		args: [{ name: "name", optional: true, rest: true }],
		describe: "command.model",
		run: async (session, { rest }) => {
			if (rest === "") {
				session.notice(modelLines(session));
			} else {
				await session.setModel(rest);
			}
		},
	},
	{
		name: "new",
		describe: "command.new",
		run: (session) => {
			session.newRoom();
		},
	},
	{
		name: "stop",
		describe: "command.stop",
		run: (session) => session.interrupt(),
	},
	{
		name: "clear",
		describe: "command.clear",
		run: (session) => session.clear(),
	},
	{
		name: "approve",
		aliases: ["allow"],
		describe: "command.approve",
		run: async (session) => {
			await session.approve();
		},
	},
	{
		name: "deny",
		aliases: ["reject"],
		describe: "command.deny",
		run: async (session) => {
			await session.deny();
		},
	},
	...(canExport
		? [
				{
					name: "export",
					describe: "command.export",
					run: (session) => session.exportLastRun(),
				} satisfies CommandSpec<Session>,
			]
		: []),
];
