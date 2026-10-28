/**
 * Narrow an unknown value to a plain object.
 *
 * Rows from a Pixel response are `unknown` until each one is checked, so the
 * parsers narrow with this before reading a field instead of casting.
 *
 * @name isRecord
 * @param value - Any value.
 * @return True when the value is a non-null, non-array object.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);
