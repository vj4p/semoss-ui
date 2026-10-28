/**
 * The server never returns a secret's value. A secret that has one comes back
 * as this marker and sending it back means "unchanged"; one without comes back
 * empty. Keep in sync with `SocialPropertySecrets.MARKER` in the backend.
 */
export const SECRET_SET = "__SECRET_SET__";

/** Property names that hold a secret even before the server has one for them. */
const SECRET_LABEL =
	/secret|password|passwd|credential|private_?key|api_?key|maps_api/i;

/** One property of a login provider, as the Configuration page edits it. */
export interface FieldProps {
	/** The property's key */
	label: string;
	/** What the input holds: the typed value, or {@link SECRET_SET} for an untouched secret */
	value: string;
	/** The secret held a value when the page loaded */
	wasSet?: boolean;
}

/**
 * Read one property from the server's reply into a field.
 *
 * @param label - The property's key.
 * @param value - What the server sent; anything but text is shown as text, and
 * nothing as empty.
 * @returns The field, marked `wasSet` when the server holds a secret for it.
 */
export const toField = (label: string, value: unknown): FieldProps => {
	const text =
		typeof value === "string" ? value : value == null ? "" : String(value);
	return { label, value: text, wasSet: text === SECRET_SET };
};

/**
 * Whether the field's value is the server's marker for a secret it holds, never
 * a value to show.
 *
 * @param field - The field.
 * @returns True for an untouched secret that has a value on the server.
 */
export const isMasked = (field: FieldProps): boolean =>
	field.value === SECRET_SET;

/**
 * Whether the field's input should hide what is typed: a secret the server
 * holds, or a property whose name says it is one.
 *
 * @param field - The field.
 * @returns True when the input should be a password input.
 */
export const isSecretField = (field: FieldProps): boolean =>
	isMasked(field) || SECRET_LABEL.test(field.label);

/**
 * What the field's input shows. The marker is never shown, so a secret that is
 * set reads as an empty input.
 *
 * @param field - The field.
 * @returns The text for the input.
 */
export const getInputValue = (field: FieldProps): string =>
	isMasked(field) ? "" : field.value;

/**
 * The value a field takes when the user edits its input. Emptying a secret that
 * was set keeps it: the marker tells the server it is unchanged. Whitespace is
 * a value like any other.
 *
 * @param field - The field as it is now.
 * @param typed - What the input holds after the edit.
 * @returns The field's new value.
 */
export const nextFieldValue = (field: FieldProps, typed: string): string =>
	typed === "" && field.value !== "" && !isMasked(field) && field.wasSet
		? SECRET_SET
		: typed;

/**
 * The properties to save, by key. A secret left alone goes back as the marker,
 * which the server reads as "keep it"; the server's real value is never held
 * here, so it cannot be sent.
 *
 * @param fields - The provider's fields.
 * @returns Each key with its value, empty text for none.
 */
export const toPropertyValues = (
	fields: readonly FieldProps[],
): Record<string, string> => {
	const values: Record<string, string> = {};
	for (const field of fields) {
		values[field.label] = field.value || "";
	}
	return values;
};
