import { describe, expect, it } from "vitest";
import {
	acceptsArgs,
	type CommandSpec,
	createCommandRegistry,
	formatUsage,
} from "./registry";

const spec = (
	name: string,
	extra: Partial<CommandSpec<void>> = {},
): CommandSpec<void> => ({
	name,
	describe: "command.help",
	run: () => undefined,
	...extra,
});

describe("createCommandRegistry", () => {
	const registry = createCommandRegistry([
		spec("help"),
		spec("harness"),
		spec("approve", { aliases: ["allow"] }),
		spec("stop"),
	]);

	it("resolves names and aliases to the same spec", () => {
		expect(registry.resolve("approve")?.name).toBe("approve");
		expect(registry.resolve("allow")?.name).toBe("approve");
	});

	it("never resolves a prefix", () => {
		expect(registry.resolve("ha")).toBeUndefined();
	});

	it("rejects a name registered twice, including as an alias", () => {
		expect(() => createCommandRegistry([spec("a"), spec("a")])).toThrow(
			/registered twice/,
		);
		expect(() =>
			createCommandRegistry([spec("a"), spec("b", { aliases: ["a"] })]),
		).toThrow(/registered twice/);
	});

	it("rejects names a user could not type as one lowercase word", () => {
		for (const bad of ["", "Help", ":help", "two words", "9lives"]) {
			expect(() => createCommandRegistry([spec(bad)])).toThrow(
				/invalid command name/,
			);
		}
	});

	it("rejects argument lists it could not bind unambiguously", () => {
		expect(() =>
			createCommandRegistry([
				spec("x", {
					args: [{ name: "a", optional: true }, { name: "b" }],
				}),
			]),
		).toThrow(/follows an optional one/);
		expect(() =>
			createCommandRegistry([
				spec("x", { args: [{ name: "a", rest: true }, { name: "b" }] }),
			]),
		).toThrow(/only the last argument may be rest/);
	});

	describe("suggest", () => {
		it("prefers a prefix", () => {
			expect(registry.suggest("ha")).toBe("harness");
		});

		it("suggests the alias a user was reaching for", () => {
			expect(registry.suggest("allo")).toBe("allow");
		});

		it("catches a transposition and a dropped letter", () => {
			expect(registry.suggest("hlep")).toBe("help");
			expect(registry.suggest("stp")).toBe("stop");
		});

		it("suggests nothing when nothing is close", () => {
			expect(registry.suggest("xyzzy")).toBeUndefined();
			expect(registry.suggest("")).toBeUndefined();
		});

		it("holds short input to one edit, where two reaches almost anything", () => {
			const short = createCommandRegistry([spec("new")]);
			// Two edits from "new" by the numbers, unrelated in intent.
			expect(short.suggest("xw")).toBeUndefined();
			expect(short.suggest("nw")).toBe("new");
		});
	});
});

describe("formatUsage", () => {
	it("marks required, optional and rest arguments", () => {
		expect(
			formatUsage(
				spec("send", {
					args: [
						{ name: "to" },
						{ name: "subject", optional: true },
						{ name: "body", optional: true, rest: true },
					],
				}),
			),
		).toBe(":send <to> [subject] [body…]");
	});

	it("is the bare name when there are no arguments", () => {
		expect(formatUsage(spec("help"))).toBe(":help");
	});
});

describe("acceptsArgs", () => {
	const fixed = spec("x", {
		args: [{ name: "a" }, { name: "b", optional: true }],
	});
	const variadic = spec("y", {
		args: [{ name: "a", optional: true, rest: true }],
	});

	it("enforces the required count and the maximum", () => {
		expect(acceptsArgs(fixed, 0)).toBe(false);
		expect(acceptsArgs(fixed, 1)).toBe(true);
		expect(acceptsArgs(fixed, 2)).toBe(true);
		expect(acceptsArgs(fixed, 3)).toBe(false);
	});

	it("has no maximum with a rest argument", () => {
		expect(acceptsArgs(variadic, 0)).toBe(true);
		expect(acceptsArgs(variadic, 7)).toBe(true);
	});

	it("takes no arguments when it declares none", () => {
		expect(acceptsArgs(spec("z"), 0)).toBe(true);
		expect(acceptsArgs(spec("z"), 1)).toBe(false);
	});
});
