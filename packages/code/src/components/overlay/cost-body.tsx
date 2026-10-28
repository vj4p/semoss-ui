import { useId } from "react";
import { useTranslation } from "@semoss/i18n";
import { H4, P } from "@semoss/ui/next";
import type { CostSummary } from "@/api/cost-summary";
import { costLabel, formatMoney } from "@/utility/cost-label";

/**
 * A number of tokens in the reader's language, abbreviated past a thousand.
 *
 * @name formatTokens
 * @param tokens - The count.
 * @param locale - A BCP 47 tag.
 * @return The abbreviated count.
 */
const formatTokens = (tokens: number, locale: string): string =>
	new Intl.NumberFormat(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(tokens);

/**
 * The populated `:cost` view: the totals, then each model's share.
 *
 * @name CostBody
 * @param props.summary - The room's usage.
 * @param props.locale - A BCP 47 tag, for numbers and money.
 */
export const CostBody = ({
	summary,
	locale,
}: {
	summary: CostSummary;
	locale: string;
}) => {
	const { t } = useTranslation("code");
	const summaryId = useId();
	const modelsId = useId();
	const noPrice = t("overlay.cost.noPrice");
	const figures = [
		[t("overlay.cost.totalCost"), costLabel(summary, noPrice, locale)],
		[
			t("overlay.cost.totalTokens"),
			formatTokens(summary.totalTokens, locale),
		],
		[t("overlay.cost.calls"), String(summary.totalCalls)],
	] as const;

	return (
		<div className="flex flex-col gap-6 font-mono">
			<section
				aria-labelledby={summaryId}
				className="rounded-lg border bg-accent p-4"
			>
				<H4 id={summaryId} className="mb-3 text-sm">
					{t("overlay.cost.summary")}
				</H4>
				<dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					{figures.map(([label, value]) => (
						<div key={label}>
							<dt className="text-muted-foreground text-xs">
								{label}
							</dt>
							<dd className="font-medium text-lg">{value}</dd>
						</div>
					))}
				</dl>
			</section>

			<section aria-labelledby={modelsId} className="flex flex-col gap-2">
				<H4 id={modelsId} className="text-sm">
					{t("overlay.cost.byModel", {
						count: summary.models.length,
					})}
				</H4>
				<ul className="flex flex-col gap-2">
					{summary.models.map((model) => (
						<li
							key={model.name}
							className="flex flex-col gap-2 rounded-md border p-3"
						>
							<div className="flex items-center justify-between gap-2">
								<span className="break-words font-medium text-sm">
									{model.name ||
										t("overlay.cost.unknownModel")}
								</span>
								<span className="font-medium">
									{model.cost === null
										? noPrice
										: formatMoney(
												model.cost,
												summary.currency,
												locale,
											)}
								</span>
							</div>
							<dl className="grid grid-cols-2 gap-2 text-muted-foreground text-xs sm:grid-cols-4">
								{(
									[
										[
											t("overlay.cost.input"),
											model.inputTokens,
										],
										[
											t("overlay.cost.output"),
											model.outputTokens,
										],
										[
											t("overlay.cost.total"),
											model.totalTokens,
										],
									] as const
								).map(([label, tokens]) => (
									<div key={label}>
										<dt>{label}</dt>
										<dd className="font-medium text-foreground">
											{formatTokens(tokens, locale)}
										</dd>
									</div>
								))}
								<div>
									<dt>{t("overlay.cost.callsShort")}</dt>
									<dd className="font-medium text-foreground">
										{model.calls}
									</dd>
								</div>
							</dl>
						</li>
					))}
				</ul>
			</section>

			<div className="rounded-md border border-info bg-info-tint p-3">
				<P className="text-info text-xs">
					{summary.unpricedModels === 0 ? (
						t("overlay.cost.noteEstimate")
					) : (
						<>
							<strong>
								{t("overlay.cost.noteUnpricedTitle", {
									count: summary.unpricedModels,
									total: summary.models.length,
								})}
							</strong>{" "}
							{summary.pricedCost === null
								? t("overlay.cost.noteNoneRated")
								: t("overlay.cost.notePartial")}
						</>
					)}
				</P>
			</div>
		</div>
	);
};
