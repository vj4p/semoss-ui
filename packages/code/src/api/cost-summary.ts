import { isRecord } from "@/utility/is-record";

/** One model's usage in the room, as the `:cost` overlay lists it. */
export interface CostModelRow {
	/** The model's name, its id when it has none, or empty when the platform sent neither. */
	name: string;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	calls: number;
	/** Absent when the platform has no published price for the model. */
	cost: number | null;
}

export interface CostSummary {
	totalTokens: number;
	totalCalls: number;
	models: CostModelRow[];
	/**
	 * What the priced models cost; null when none is priced. With some models
	 * unpriced this is a minimum, not the bill.
	 */
	pricedCost: number | null;
	/** Every model has a price, so `pricedCost` is the whole cost. */
	complete: boolean;
	/** The ISO 4217 code the platform prices in. */
	currency: string;
	unpricedModels: number;
}

const count = (value: unknown): number =>
	typeof value === "number" && Number.isFinite(value) ? value : 0;

/**
 * Read a `GetModelCost` response.
 *
 * A model with no published price comes back with `priced: false` and no cost.
 * The overlay used to read that as zero and so showed a room that ran on an
 * unpriced model as costing $0.00, which reads as free. Here a missing price
 * stays missing, and `complete` says whether the total can be trusted.
 */
export const summarizeCost = (data: unknown): CostSummary | null => {
	if (!isRecord(data) || !Array.isArray(data.models)) {
		return null;
	}
	const models = data.models.map((raw): CostModelRow => {
		const m = isRecord(raw) ? raw : {};
		const priced = m.priced !== false && typeof m.cost === "number";
		return {
			name:
				(typeof m.modelName === "string" && m.modelName) ||
				(typeof m.modelId === "string" && m.modelId) ||
				"",
			inputTokens: count(m.inputTokens),
			outputTokens: count(m.outputTokens),
			totalTokens: count(m.inputTokens) + count(m.outputTokens),
			calls: count(m.llmCalls),
			cost: priced && typeof m.cost === "number" ? m.cost : null,
		};
	});
	const priced = models.filter((m) => m.cost !== null);
	return {
		totalTokens: models.reduce((sum, m) => sum + m.totalTokens, 0),
		totalCalls: models.reduce((sum, m) => sum + m.calls, 0),
		models,
		pricedCost:
			priced.length === 0
				? null
				: priced.reduce((sum, m) => sum + (m.cost ?? 0), 0),
		complete: models.length > 0 && priced.length === models.length,
		currency:
			isRecord(data.totals) &&
			typeof data.totals.currency === "string" &&
			/^[A-Z]{3}$/.test(data.totals.currency)
				? data.totals.currency
				: "USD",
		unpricedModels: models.length - priced.length,
	};
};
