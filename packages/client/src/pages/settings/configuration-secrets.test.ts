import { describe, expect, it } from "vitest";
import {
	getInputValue,
	isMasked,
	isSecretField,
	nextFieldValue,
	SECRET_SET,
	toField,
	toPropertyValues,
} from "./configuration-secrets";

describe("toField", () => {
	it("marks a secret the server holds as set, and keeps the marker as its value", () => {
		expect(toField("google_secret", SECRET_SET)).toEqual({
			label: "google_secret",
			value: SECRET_SET,
			wasSet: true,
		});
	});

	it("reads a key with no value as empty and not set", () => {
		expect(toField("google_secret", "")).toEqual({
			label: "google_secret",
			value: "",
			wasSet: false,
		});
		expect(toField("google_secret", null).value).toBe("");
		expect(toField("google_secret", undefined).value).toBe("");
	});

	it("shows a value that is not text as text instead of passing it on raw", () => {
		expect(toField("port", 8080).value).toBe("8080");
		expect(toField("enabled", true).value).toBe("true");
	});

	it("keeps whitespace as it came", () => {
		expect(toField("name", "  ").value).toBe("  ");
	});
});

describe("isSecretField", () => {
	it.each([
		"google_secret",
		"CLIENT_SECRET",
		"db_password",
		"passwd",
		"service_credential",
		"private_key",
		"privatekey",
		"api_key",
		"apikey",
		"maps_api",
	])("hides %s by its name, before the server has a value", (label) => {
		expect(isSecretField(toField(label, ""))).toBe(true);
	});

	it.each(["google_client_id", "redirect_uri", "name", "scope"])(
		"leaves %s as plain text",
		(label) => {
			expect(isSecretField(toField(label, "abc"))).toBe(false);
		},
	);

	it("hides a property the server holds a secret for, whatever it is called", () => {
		expect(isSecretField(toField("token", SECRET_SET))).toBe(true);
	});
});

describe("masked values", () => {
	it("never puts the marker in the input", () => {
		const field = toField("google_secret", SECRET_SET);
		expect(isMasked(field)).toBe(true);
		expect(getInputValue(field)).toBe("");
	});

	it("shows an ordinary value as it is", () => {
		const field = toField("google_client_id", "abc");
		expect(isMasked(field)).toBe(false);
		expect(getInputValue(field)).toBe("abc");
	});
});

describe("nextFieldValue", () => {
	it("keeps a secret that was set when it is emptied after typing a replacement", () => {
		const loaded = toField("google_secret", SECRET_SET);
		const typed = { ...loaded, value: "n" };
		expect(nextFieldValue(typed, "")).toBe(SECRET_SET);
	});

	it("takes what is typed over a secret that was set", () => {
		const field = toField("google_secret", SECRET_SET);
		expect(nextFieldValue(field, "new-secret")).toBe("new-secret");
	});

	it("lets a key with no value stay empty, instead of inventing a secret", () => {
		const field = toField("google_secret", "");
		expect(nextFieldValue(field, "")).toBe("");
		const typed = { ...field, value: "x" };
		expect(nextFieldValue(typed, "")).toBe("");
	});

	it("lets an ordinary property be emptied", () => {
		const field = toField("redirect_uri", "https://example.test");
		expect(nextFieldValue(field, "")).toBe("");
	});

	it("treats spaces as a value, not as empty", () => {
		const field = toField("google_secret", SECRET_SET);
		expect(nextFieldValue(field, " ")).toBe(" ");
	});
});

describe("toPropertyValues", () => {
	it("sends an untouched secret back as the marker, never a value", () => {
		const values = toPropertyValues([
			toField("google_secret", SECRET_SET),
			toField("google_client_id", "abc"),
		]);
		expect(values).toEqual({
			google_secret: SECRET_SET,
			google_client_id: "abc",
		});
	});

	it("sends an empty property as empty text", () => {
		expect(toPropertyValues([toField("scope", "")])).toEqual({ scope: "" });
	});

	it("sends a replaced secret as typed", () => {
		const loaded = toField("google_secret", SECRET_SET);
		const edited = { ...loaded, value: nextFieldValue(loaded, "new") };
		expect(toPropertyValues([edited])).toEqual({ google_secret: "new" });
	});
});
