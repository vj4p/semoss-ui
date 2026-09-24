import { useMemo } from "react";
import type { ItemStatus } from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";

/**
 * The words the transcript adds to agent-core's lines, in the current
 * language: what a row is and what state it is in, for a screen reader, and a
 * tool call's duration.
 *
 * Resolved once for the whole transcript and passed down, rather than looked
 * up in every line, so that a long transcript does not subscribe each of its
 * lines to i18next.
 *
 * @name useLineLabels
 * @return The labels, and formatters for the ones with a number in them.
 */
export const useLineLabels = () => {
	const { t, i18n } = useTranslation("code");
	const language = i18n.resolvedLanguage ?? i18n.language;

	return useMemo(() => {
		const seconds = new Intl.NumberFormat(language, {
			style: "unit",
			unit: "second",
			unitDisplay: "narrow",
			maximumFractionDigits: 1,
		});
		return {
			tool: t("line.tool"),
			subagent: t("line.subagent"),
			reasoning: t("line.reasoning"),
			truncated: t("line.truncated"),
			outputLines: (count: number) => t("line.outputLines", { count }),
			status: (status: ItemStatus) => t(`itemStatus.${status}`),
			duration: (milliseconds: number) =>
				seconds.format(milliseconds / 1_000),
		};
	}, [t, language]);
};
