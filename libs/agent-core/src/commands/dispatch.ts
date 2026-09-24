/**
 * Turn a line of input into either a prompt or a command that has run.
 *
 * Everything that can go wrong with a command comes back as data, never as an
 * exception: an unknown name, the wrong number of arguments, and a command
 * that threw all return `{ kind: "error" }` with a message ready to print. A
 * console has exactly one place to show that message, and letting a throw
 * escape from here would mean every host re-deriving the same wording.
 */

import { type Translate, translateEnglish } from "../i18n/messages";
import { describeError } from "../util/describe-error";
import { parseInput } from "./parse";
import { acceptsArgs, type CommandRegistry, formatUsage } from "./registry";

export type DispatchResult =
	/** Nothing was typed. */
	| { kind: "empty" }
	/** Not a command: send `text` to the agent. */
	| { kind: "prompt"; text: string }
	/** A command ran to completion. `name` is its canonical name, not the alias typed. */
	| { kind: "ran"; name: string }
	/** Nothing ran, or what ran failed. `message` is translated and ready to print. */
	| { kind: "error"; message: string };

export const dispatch = async <C>(
	registry: CommandRegistry<C>,
	context: C,
	raw: string,
	{ translate = translateEnglish }: { translate?: Translate } = {},
): Promise<DispatchResult> => {
	const input = parseInput(raw);
	if (input.kind !== "command") {
		return input;
	}
	if (input.name === "") {
		return { kind: "error", message: translate("command.missingName") };
	}

	const spec = registry.resolve(input.name);
	if (spec === undefined) {
		const suggestion = registry.suggest(input.name);
		return {
			kind: "error",
			message:
				suggestion === undefined
					? translate("command.unknown", { name: input.name })
					: translate("command.didYouMean", {
							name: input.name,
							suggestion,
						}),
		};
	}

	if (!acceptsArgs(spec, input.args.length)) {
		return {
			kind: "error",
			message: translate("command.usage", { usage: formatUsage(spec) }),
		};
	}

	try {
		await spec.run(context, { args: input.args, rest: input.rest });
	} catch (error) {
		return {
			kind: "error",
			message: translate("command.failed", {
				name: spec.name,
				message: describeError(error),
			}),
		};
	}
	return { kind: "ran", name: spec.name };
};
