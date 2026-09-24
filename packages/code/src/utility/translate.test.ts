import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MESSAGES } from "@semoss/agent-core";
import { codeResources, I18nBuilder, LANGUAGES } from "@semoss/i18n";
import { createTranslate } from "./translate";

/** A locale file: its strings, nested under the parts of their keys. */
type Catalog = { readonly [key: string]: string | Catalog };

const isCatalog = (value: unknown): value is Catalog =>
	typeof value === "object" &&
	value !== null &&
	!Array.isArray(value) &&
	Object.values(value).every(
		(child) => typeof child === "string" || isCatalog(child),
	);

/** Every string in a catalog, by its dotted key. */
const flatten = (catalog: Catalog, prefix = ""): [string, string][] =>
	Object.entries(catalog).flatMap(([key, value]): [string, string][] =>
		typeof value === "string"
			? [[`${prefix}${key}`, value]]
			: flatten(value, `${prefix}${key}.`),
	);

/** A language's code catalog, loaded the way the app loads it. */
const load = async (language: string): Promise<Map<string, string>> => {
	const module: unknown = await codeResources.load.code(language);
	const catalog =
		typeof module === "object" && module !== null && "default" in module
			? module.default
			: undefined;
	if (!isCatalog(catalog)) {
		throw new Error(`The ${language} code catalog is not a catalog`);
	}
	return new Map(flatten(catalog));
};

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const PLACEHOLDER = /\{\{(\w+)\}\}/g;
// A colon right before a command's name, or a placeholder for one. The
// catalogs put a space after a colon in prose, so this finds only commands.
const COMMAND = /:(?:[a-z]+|\{\{\w+\}\})/g;
const LRI = "\u2066";
const PDI = "\u2069";

/** The names of a string's placeholders, sorted. */
const placeholders = (text: string): string[] =>
	[...text.matchAll(PLACEHOLDER)].map((match) => match[1]).sort();

/** The commands a string names, sorted. */
const commands = (text: string): string[] =>
	[...text.matchAll(COMMAND)].map((match) => match[0]).sort();

/** Agent-core's messages in a catalog, by agent-core's keys. */
const core = (strings: Map<string, string>): Map<string, string> =>
	new Map(
		[...strings]
			.filter(([key]) => key.startsWith("core."))
			.map(([key, text]): [string, string] => [
				key.slice("core.".length),
				text,
			]),
	);

/** The console's own strings in a catalog: all but agent-core's. */
const host = (strings: Map<string, string>): Map<string, string> =>
	new Map([...strings].filter(([key]) => !key.startsWith("core.")));

/**
 * A catalog's strings by key, with a plural's forms gathered under the key
 * they share. A string that is not a plural has the one form "".
 */
const forms = (
	strings: Map<string, string>,
): Map<string, Map<string, string>> => {
	const byKey = new Map<string, Map<string, string>>();
	for (const [key, text] of strings) {
		const form = PLURAL_SUFFIX.exec(key)?.[1] ?? "";
		const base = form === "" ? key : key.slice(0, -(form.length + 1));
		const known = byKey.get(base) ?? new Map<string, string>();
		known.set(form, text);
		byKey.set(base, known);
	}
	return byKey;
};

const CODES = LANGUAGES.map((language) => language.code);
const catalogs = new Map<string, Map<string, string>>();

beforeAll(async () => {
	for (const code of CODES) {
		catalogs.set(code, await load(code));
	}
});

/** A catalog `beforeAll` loaded. */
const catalog = (language: string): Map<string, string> => {
	const strings = catalogs.get(language);
	if (strings === undefined) {
		throw new Error(`The ${language} code catalog was not loaded`);
	}
	return strings;
};

describe("the code catalogs", () => {
	it("have agent-core's English word for word", () => {
		expect(Object.fromEntries(core(catalog("en")))).toEqual(MESSAGES);
	});

	describe.each(CODES)("in %s", (language) => {
		it("have every agent-core message, and no others", () => {
			expect([...core(catalog(language)).keys()].sort()).toEqual(
				Object.keys(MESSAGES).sort(),
			);
		});

		it("keep each agent-core message's placeholders and commands", () => {
			const messages = core(catalog(language));
			for (const [key, english] of Object.entries(MESSAGES)) {
				const text = messages.get(key) ?? "";
				expect(text.trim(), key).not.toBe("");
				expect(placeholders(text), key).toEqual(placeholders(english));
				expect(commands(text), key).toEqual(commands(english));
			}
		});

		it("have the console's own strings, in the plural forms the language uses", () => {
			const english = forms(host(catalog("en")));
			const strings = forms(host(catalog(language)));
			expect([...strings.keys()].sort()).toEqual(
				[...english.keys()].sort(),
			);

			const categories = [
				...new Intl.PluralRules(language).resolvedOptions()
					.pluralCategories,
			].sort();
			for (const [key, variants] of english) {
				const expected = variants.has("") ? [""] : categories;
				expect(
					[...(strings.get(key)?.keys() ?? [])].sort(),
					key,
				).toEqual(expected);
			}
		});

		it("keep the console's own placeholders and commands", () => {
			const english = forms(host(catalog("en")));
			for (const [key, variants] of forms(host(catalog(language)))) {
				const source = english.get(key);
				const reference = source?.get("") ?? source?.get("other") ?? "";
				for (const [form, text] of variants) {
					expect(text.trim(), `${key} ${form}`).not.toBe("");
					expect(commands(text), key).toEqual(commands(reference));
					if (form === "") {
						expect(placeholders(text), key).toEqual(
							placeholders(reference),
						);
					} else {
						// The form for one thing may say "one" rather than the count.
						expect(
							placeholders(reference),
							`${key} ${form}`,
						).toEqual(expect.arrayContaining(placeholders(text)));
					}
				}
			}
		});
	});

	it("isolate each Arabic command, so that it reads left to right", () => {
		const found = [...catalog("ar")].flatMap(([key, text]) =>
			[...text.matchAll(COMMAND)].map((match) => ({ key, text, match })),
		);

		expect(found.length).toBeGreaterThan(0);
		for (const { key, text, match } of found) {
			expect(text[match.index - 1], key).toBe(LRI);
			expect(text[match.index + match[0].length], key).toBe(PDI);
		}
	});
});

describe("createTranslate", () => {
	const builder = new I18nBuilder(codeResources, { lockToEnglish: true });
	const translate = createTranslate(builder.i18n);

	beforeAll(async () => {
		await builder.ready;
	});

	afterAll(async () => {
		await builder.i18n.changeLanguage("en");
	});

	it("reads agent-core's messages from the code catalog", () => {
		expect(translate("run.awaitingApproval", { tool: "Bash" })).toBe(
			"Bash is waiting for approval.",
		);
	});

	it("follows the language when it changes", async () => {
		await builder.i18n.changeLanguage("fr");

		const french = catalog("fr").get("core.run.awaitingApproval");
		expect(french).toBeDefined();
		expect(translate("run.awaitingApproval", { tool: "Bash" })).toBe(
			french?.replace("{{tool}}", "Bash"),
		);
	});
});
