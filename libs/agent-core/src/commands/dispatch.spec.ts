import { describe, expect, it, vi } from "vitest";
import type { Translate } from "../i18n/messages";
import { dispatch } from "./dispatch";
import { type CommandSpec, createCommandRegistry } from "./registry";

interface Context {
	calls: string[];
}

const commands: CommandSpec<Context>[] = [
	{
		name: "echo",
		aliases: ["say"],
		args: [{ name: "text", rest: true }],
		describe: "command.help",
		run: (context, { args, rest }) => {
			context.calls.push(`echo:${args.join("|")}:${rest}`);
		},
	},
	{
		name: "stop",
		describe: "command.stop",
		run: async (context) => {
			context.calls.push("stop");
		},
	},
	{
		name: "boom",
		describe: "command.help",
		run: () => {
			throw new Error("kaput");
		},
	},
];

const registry = createCommandRegistry(commands);

const run = (raw: string, translate?: Translate) => {
	const context: Context = { calls: [] };
	return {
		context,
		result: dispatch(registry, context, raw, { translate }),
	};
};

describe("dispatch", () => {
	it("passes empty input and prompts through without running anything", async () => {
		const empty = run("   ");
		await expect(empty.result).resolves.toEqual({ kind: "empty" });

		const prompt = run("hello :stop");
		await expect(prompt.result).resolves.toEqual({
			kind: "prompt",
			text: "hello :stop",
		});
		expect(prompt.context.calls).toEqual([]);
	});

	it("runs a command by name or alias and reports its canonical name", async () => {
		const byAlias = run(':say "a b" c');
		await expect(byAlias.result).resolves.toEqual({
			kind: "ran",
			name: "echo",
		});
		expect(byAlias.context.calls).toEqual(['echo:a b|c:"a b" c']);
	});

	it("awaits an async command before reporting it ran", async () => {
		const stop = run(":stop");
		await expect(stop.result).resolves.toEqual({
			kind: "ran",
			name: "stop",
		});
		expect(stop.context.calls).toEqual(["stop"]);
	});

	it("asks for a name after a bare colon", async () => {
		await expect(run(":").result).resolves.toEqual({
			kind: "error",
			message:
				"Type a command name after the colon, or :help to list commands.",
		});
	});

	it("suggests the nearest command for a typo, without running it", async () => {
		const typo = run(":stpo");
		await expect(typo.result).resolves.toEqual({
			kind: "error",
			message: "Unknown command :stpo. Did you mean :stop?",
		});
		expect(typo.context.calls).toEqual([]);
	});

	it("says a command is unknown when nothing is close", async () => {
		await expect(run(":xyzzy").result).resolves.toEqual({
			kind: "error",
			message: "Unknown command :xyzzy. Type :help to list commands.",
		});
	});

	it("prints usage instead of running with the wrong arguments", async () => {
		const missing = run(":echo");
		await expect(missing.result).resolves.toEqual({
			kind: "error",
			message: "Usage: :echo <text…>",
		});
		expect(missing.context.calls).toEqual([]);

		await expect(run(":stop now").result).resolves.toEqual({
			kind: "error",
			message: "Usage: :stop",
		});
	});

	it("turns a throwing command into an error result", async () => {
		await expect(run(":boom").result).resolves.toEqual({
			kind: "error",
			message: ":boom failed: kaput",
		});
	});

	it("words every error through the host's translate", async () => {
		const translate = vi.fn<Translate>(
			(key, params) => `${key}${JSON.stringify(params ?? {})}`,
		);
		await expect(run(":stpo", translate).result).resolves.toEqual({
			kind: "error",
			message: 'command.didYouMean{"name":"stpo","suggestion":"stop"}',
		});
	});
});
