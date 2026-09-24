import type { ModelOption } from "@semoss/agent-core";
import { runPixel } from "@semoss/sdk/react";
import type { Engine } from "@semoss/shared";

/** The profile metadata key that holds the user's default model. */
const DEFAULT_MODEL_KEY = "text-generation-model";

/**
 * Throw when a pixel response contains an operation error. No-op when the
 * error list is empty.
 *
 * @name assertPixelSuccess
 * @param errors - Operation errors collected from a runPixel response.
 */
const assertPixelSuccess = (errors: string[]): void => {
	if (errors.length > 0) {
		throw new Error(errors.join(""));
	}
};

/**
 * The models a run can use: every model engine visible to the user that is
 * tagged text-generation, in the order MyEngines returns them.
 *
 * @name getTextGenerationModels
 * @param insightId - Insight the pixel executes against.
 * @return The models, or an empty array when the user can use none.
 */
export const getTextGenerationModels = async (
	insightId: string,
): Promise<ModelOption[]> => {
	const response = await runPixel<[Engine[]]>(
		`META | MyEngines(metaKeys=[], metaFilters=[{"tag":"text-generation"}], engineTypes=["MODEL"]);`,
		insightId,
	);
	assertPixelSuccess(response.errors);

	const engines = response.pixelReturn[0]?.output;
	if (!Array.isArray(engines)) {
		return [];
	}
	return engines.map((engine) => ({
		id: engine.engine_id,
		name: engine.engine_display_name || engine.engine_name,
	}));
};

/**
 * The model the user chose as their default, from their profile metadata.
 *
 * Read with GetUserMetadata, which queries the stored value, rather than
 * GetUserInfo, which returns the copy loaded into the session at sign-in: a
 * default changed from another session since then is seen here.
 *
 * @name getDefaultModelId
 * @param insightId - Insight the pixel executes against.
 * @return The engine id, or undefined when the user has not chosen one. It
 * may name a model that is no longer offered; the session checks.
 */
export const getDefaultModelId = async (
	insightId: string,
): Promise<string | undefined> => {
	const response = await runPixel<[Record<string, unknown>]>(
		`META | GetUserMetadata(metaKeys=${JSON.stringify([DEFAULT_MODEL_KEY])});`,
		insightId,
	);
	assertPixelSuccess(response.errors);

	const value = response.pixelReturn[0]?.output?.[DEFAULT_MODEL_KEY];
	const first = Array.isArray(value) ? value[0] : value;
	return typeof first === "string" && first.trim() !== "" ? first : undefined;
};
