import type { Translate } from "@semoss/agent-core";
import type { useTranslation } from "@semoss/i18n";

/** The app's i18next instance, as useTranslation returns it. */
type I18n = ReturnType<typeof useTranslation>["i18n"];

/**
 * Translate agent-core's messages with the app's i18next instance.
 *
 * The code namespace keeps them under `core`. The prefix is added here because
 * i18next applies a `keyPrefix` only through `getFixedT`, and ignores one
 * passed to `t` as an option. The language is read on each call rather than
 * fixed, so what the session says after a language switch is in the new
 * language.
 *
 * @name createTranslate
 * @param i18n - The app's i18next instance.
 * @return A Translate for the session, and for drawing its entries.
 */
export const createTranslate =
	(i18n: I18n): Translate =>
	(key, params) =>
		String(i18n.t(`core.${key}`, { ...params, ns: "code" }));
