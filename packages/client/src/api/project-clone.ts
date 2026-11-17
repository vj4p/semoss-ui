/**
 * The Pixel text for cloning an app or a skill from a template. The name is
 * typed by a person, so it goes into the query as an escaped string literal: a
 * name with a quote or backslash in it must not end the literal early and turn
 * the call into a syntax error.
 */

/**
 * A Pixel string literal for a value.
 *
 * @param value - Text to place in a query.
 * @returns The value in double quotes, with quotes and backslashes escaped.
 */
const literal = (value: string): string => JSON.stringify(value);

/**
 * Clone a skill.
 *
 * @param skillId - The skill to copy.
 * @param name - The new skill's name, as typed.
 * @returns The Pixel to run.
 */
export const buildCloneSkillPixel = (skillId: string, name: string): string =>
	`CloneSkill(skillId=[${literal(skillId)}], catalogName=[${literal(name)}]);`;

/**
 * Create an app from a template app.
 *
 * @param name - The new app's name, as typed.
 * @param templateId - The template app's project id.
 * @param isGlobal - Whether every user can discover the new app.
 * @returns The Pixel to run.
 */
export const buildCreateAppFromTemplatePixel = (
	name: string,
	templateId: string,
	isGlobal: boolean,
): string =>
	`CreateAppFromTemplate(catalogName=[${literal(name)}], projectTemplate=[${literal(templateId)}], global=[${literal(String(isGlobal))}]);`;
