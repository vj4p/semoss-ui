/**
 * The console's commands, as data a host can list, validate and run.
 *
 * A command is a spec rather than a branch in a switch so that three things
 * read the same definition: the dispatcher that runs it, `:help` that lists
 * it, and the usage line printed when it is called wrong. A switch would let
 * those drift, and a help screen that disagrees with what the console accepts
 * is worse than none.
 *
 * `C` is whatever the commands act on. It is a parameter because the session
 * commands and a host's own commands (the Phase 4 overlays, say) act on
 * different things, and this file should not have to know either.
 */

import type { MessageKey } from "../i18n/messages";

export interface CommandArg {
	/**
	 * Shown in usage as `<name>`, or `[name]` when optional. It is syntax, not
	 * prose, so it is never translated.
	 */
	name: string;
	optional?: boolean;
	/** Takes every remaining argument. Only allowed last. */
	rest?: boolean;
}

export interface CommandInput {
	/** The arguments, split on whitespace with quotes honoured. */
	args: string[];
	/** Everything after the command name, trimmed and otherwise as typed. */
	rest: string;
}

export interface CommandSpec<C> {
	/** Lowercase, typed after the colon. */
	name: string;
	aliases?: readonly string[];
	args?: readonly CommandArg[];
	/** The one-line description `:help` shows. */
	describe: MessageKey;
	run: (context: C, input: CommandInput) => void | Promise<void>;
}

export interface CommandRegistry<C> {
	/** In registration order, which is the order `:help` lists them. */
	readonly commands: readonly CommandSpec<C>[];
	/** Exact match on a name or alias. Never a prefix: see {@link suggest}. */
	resolve: (name: string) => CommandSpec<C> | undefined;
	/**
	 * The name or alias the user probably meant, or undefined when nothing is
	 * close.
	 *
	 * This suggests and never resolves. Running the nearest match would make
	 * `:st` mean `:stop` today and something else the day a `:status` is
	 * added, and a console that runs agents should not guess at which command
	 * the user meant.
	 */
	suggest: (name: string) => string | undefined;
}

const VALID_NAME = /^[a-z][a-z0-9-]*$/;

/** Levenshtein distance, on one reused row. */
const editDistance = (a: string, b: string): number => {
	const row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		let diagonal = row[0];
		row[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const above = row[j];
			row[j] = Math.min(
				row[j] + 1,
				row[j - 1] + 1,
				diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
			diagonal = above;
		}
	}
	return row[b.length];
};

/**
 * Reject an argument list the dispatcher could not bind unambiguously: a
 * required argument after an optional one, or a rest argument that is not
 * last.
 */
const checkArgs = (spec: { name: string; args?: readonly CommandArg[] }) => {
	const args = spec.args ?? [];
	args.forEach((arg, index) => {
		if (arg.rest && index !== args.length - 1) {
			throw new Error(
				`:${spec.name}: only the last argument may be rest`,
			);
		}
		if (!arg.optional && args.slice(0, index).some((a) => a.optional)) {
			throw new Error(
				`:${spec.name}: required argument <${arg.name}> follows an optional one`,
			);
		}
	});
};

/**
 * @throws on a malformed name, a name or alias registered twice, or an
 * argument list the dispatcher could not bind. These are programming errors
 * in a spec, so they fail when the registry is built rather than when a user
 * happens to type the broken command.
 */
export const createCommandRegistry = <C>(
	specs: readonly CommandSpec<C>[],
): CommandRegistry<C> => {
	const byName = new Map<string, CommandSpec<C>>();
	for (const spec of specs) {
		checkArgs(spec);
		for (const name of [spec.name, ...(spec.aliases ?? [])]) {
			if (!VALID_NAME.test(name)) {
				throw new Error(`invalid command name ":${name}"`);
			}
			if (byName.has(name)) {
				throw new Error(`command name ":${name}" is registered twice`);
			}
			byName.set(name, spec);
		}
	}

	return {
		commands: specs,
		resolve: (name) => byName.get(name),
		suggest: (name) => {
			if (name === "") {
				return undefined;
			}
			const names = [...byName.keys()];
			const prefixed = names.find((candidate) =>
				candidate.startsWith(name),
			);
			if (prefixed !== undefined) {
				return prefixed;
			}
			// Two edits catches a transposition (`:hlep`) and a dropped letter
			// (`:modl`). On a one- or two-letter name, two edits reaches most
			// of the list, which is noise rather than a suggestion.
			const limit = name.length < 3 ? 1 : 2;
			let best: string | undefined;
			let bestDistance = limit + 1;
			for (const candidate of names) {
				const distance = editDistance(name, candidate);
				if (distance < bestDistance) {
					best = candidate;
					bestDistance = distance;
				}
			}
			return best;
		},
	};
};

/** `:harness [name…]` — the line printed when a command is called wrong. */
export const formatUsage = <C>(spec: CommandSpec<C>): string =>
	[
		`:${spec.name}`,
		...(spec.args ?? []).map((arg) => {
			const label = arg.rest ? `${arg.name}…` : arg.name;
			return arg.optional ? `[${label}]` : `<${label}>`;
		}),
	].join(" ");

/** Whether `count` arguments satisfy the spec's argument list. */
export const acceptsArgs = <C>(
	spec: CommandSpec<C>,
	count: number,
): boolean => {
	const args = spec.args ?? [];
	const required = args.filter((arg) => !arg.optional).length;
	const variadic = args.some((arg) => arg.rest);
	return count >= required && (variadic || count <= args.length);
};
