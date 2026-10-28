import { describe, expect, it } from "vitest";
import { codeResources } from "@semoss/i18n";

const LANGUAGES = ["en", "es", "fr", "nl", "ja", "ar", "hi"] as const;

type Tree = { [key: string]: string | Tree };

/** Every leaf of a translation tree, by dotted path. */
const leaves = (
	tree: Tree,
	prefix = "",
	into: Record<string, string> = {},
): Record<string, string> => {
	for (const [key, value] of Object.entries(tree)) {
		if (typeof value === "string") {
			into[`${prefix}${key}`] = value;
		} else {
			leaves(value, `${prefix}${key}.`, into);
		}
	}
	return into;
};

const placeholders = (text: string): string[] =>
	(text.match(/\{\{\w+\}\}/g) ?? []).sort();

const load = async (language: string): Promise<Tree> => {
	const loader = codeResources.load.code;
	if (!loader) {
		throw new Error("The code namespace has no loader");
	}
	const loaded = (await loader(language)) as { default: Tree };
	return loaded.default;
};

describe("overlay translations", () => {
	it("every language has every overlay key, and the cost label, with the same placeholders", async () => {
		const english = leaves(await load("en"));
		const wanted = Object.keys(english).filter(
			(key) => key.startsWith("overlay.") || key === "status.cost",
		);
		expect(wanted.length).toBeGreaterThan(40);
		for (const language of LANGUAGES) {
			const translated = leaves(await load(language));
			for (const key of wanted) {
				expect(translated[key], `${language}: ${key}`).toBeTruthy();
				expect(
					placeholders(translated[key]),
					`${language}: ${key}`,
				).toEqual(placeholders(english[key]));
			}
		}
	});
});
