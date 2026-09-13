/**
 * Shape returned by `GetModelCost`. `cost` is null when no model in scope had
 * published pricing — see `ModelCostCalculator`: an unpriced model is reported as
 * unpriced rather than as free, so null must render as "not priced" and never as
 * zero.
 */
export interface CostOutput {
	totals?: {
		cost?: number | null;
		currency?: string;
		inputTokens?: number;
		outputTokens?: number;
		cacheReadTokens?: number;
	};
	coverage?: {
		pricedModels?: number;
		unpricedModels?: number;
		complete?: boolean;
	};
}

/**
 * Money, at a scale that stays legible for an agent run.
 *
 * Runs on a cheap model cost fractions of a cent, so two decimal places would
 * render almost everything as "$0.00". Four gives a usable figure without
 * pretending to more precision than the rates carry.
 */
export const formatCost = (value: number, currency = "USD"): string => {
	const symbol = currency === "USD" ? "$" : `${currency} `;
	return `${symbol}${value.toFixed(value >= 1 ? 2 : 4)}`;
};
