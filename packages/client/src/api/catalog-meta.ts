/**
 * The Pixel text for reading and writing the metadata catalogs show: tags,
 * description and the other meta keys of an app or an engine. It is built here,
 * and not in the components that run it, so every id, type and key goes into the
 * query as an escaped string literal. A value with a quote in it then cannot end
 * the literal early and change the call.
 */

/**
 * A Pixel string literal for a value.
 *
 * @param value - Text to place in a query.
 * @returns The value in double quotes, with quotes and backslashes escaped.
 */
const literal = (value: string): string => JSON.stringify(value);

/**
 * A Pixel list of string literals.
 *
 * @param values - The strings.
 * @returns The list, such as `["tag","domain"]`.
 */
const literals = (values: readonly string[]): string =>
	JSON.stringify([...values]);

/**
 * Set metadata on an app (project).
 *
 * @param projectId - The app's project id.
 * @param meta - The meta keys to set, such as `{ tag: [...], description: "..." }`.
 * @returns The Pixel to run.
 */
export const buildSetProjectMetadataPixel = (
	projectId: string,
	meta: Record<string, unknown>,
): string =>
	`SetProjectMetadata(project=[${literal(projectId)}], meta=[${JSON.stringify(meta)}]);`;

/**
 * Set metadata on an engine (database, model, vector store and so on).
 *
 * @param engineId - The engine's id.
 * @param meta - The meta keys to set.
 * @returns The Pixel to run.
 */
export const buildSetEngineMetadataPixel = (
	engineId: string,
	meta: Record<string, unknown>,
): string =>
	`SetEngineMetadata(engine=[${literal(engineId)}], meta=[${JSON.stringify(meta)}]);`;

/**
 * The values already used for meta keys across all apps, for typeahead.
 *
 * @param metaKeys - The meta keys to list values for.
 * @returns The Pixel to run.
 */
export const buildProjectMetaValuesPixel = (
	metaKeys: readonly string[],
): string =>
	`META | GetProjectMetaValues ( metaKeys = ${literals(metaKeys)} ) ;`;

/**
 * The values already used for meta keys across all engines, for typeahead.
 *
 * @param metaKeys - The meta keys to list values for.
 * @returns The Pixel to run.
 */
export const buildDatabaseMetaValuesPixel = (
	metaKeys: readonly string[],
): string =>
	`META | GetDatabaseMetaValues ( metaKeys = ${literals(metaKeys)} ) ;`;

/**
 * The values, with how many apps use each, for a catalog's filter options.
 *
 * @param projectTypes - The app types the catalog lists.
 * @param metaKeys - The meta keys to count values for.
 * @returns The Pixel to run.
 */
export const buildProjectFilterValuesPixel = (
	projectTypes: readonly string[],
	metaKeys: readonly string[],
): string =>
	`GetProjectMetaValues(projectType=${literals(projectTypes)}, metaKeys=${literals(metaKeys)});`;

/**
 * The values, with how many engines use each, for a catalog's filter options.
 *
 * @param engineType - The engine type the catalog lists, such as `DATABASE`.
 * @param metaKeys - The meta keys to count values for.
 * @returns The Pixel to run.
 */
export const buildEngineFilterValuesPixel = (
	engineType: string,
	metaKeys: readonly string[],
): string =>
	`GetEngineMetaValues(engineTypes=[${literal(engineType)}], metaKeys=${literals(metaKeys)});`;
