import type { CostSummary } from "@/api/cost-summary";

/**
 * An amount in the summary's currency, in the reader's language. Small amounts
 * keep four decimals: a room that cost a tenth of a cent is not "$0.00".
 *
 * @name formatMoney
 * @param amount - The amount.
 * @param currency - An ISO 4217 code.
 * @param locale - A BCP 47 tag.
 * @return The formatted amount.
 */
export const formatMoney = (
	amount: number,
	currency: string,
	locale: string,
): string =>
	new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		minimumFractionDigits: amount > 0 && amount < 0.01 ? 4 : 2,
		maximumFractionDigits: amount > 0 && amount < 0.01 ? 4 : 2,
	}).format(amount);

/**
 * The room's total cost as one short label.
 *
 * A total built from the priced models alone is a minimum, so it carries a
 * `+`; with no priced model there is no total, and `noPrice` stands in. A
 * missing price is never shown as zero, which reads as free.
 *
 * @name costLabel
 * @param summary - The room's usage.
 * @param noPrice - The words for "the platform has no price for this".
 * @param locale - A BCP 47 tag.
 * @return The label.
 */
export const costLabel = (
	summary: CostSummary,
	noPrice: string,
	locale: string,
): string => {
	if (summary.pricedCost === null) {
		return noPrice;
	}
	const amount = formatMoney(summary.pricedCost, summary.currency, locale);
	return summary.complete ? amount : `${amount}+`;
};
