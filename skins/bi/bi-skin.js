/*
 * BI skin script: keeps BI's theme in step with the rest of the platform.
 * Runs in <head>, before BI starts, so the page never flashes the wrong theme.
 *
 * The theme is the platform's shared choice in localStorage ("smss-ui-theme":
 * light, dark or system). A choice stored under an app's old key is adopted,
 * as the other apps do. To switch the skin off without touching BI, run
 * localStorage.setItem("smss-bi-skin", "off") and reload.
 */
(() => {
	const THEME_KEY = "smss-ui-theme";
	const OFF_KEY = "smss-bi-skin";
	const LEGACY_KEYS = [
		"smss-ui-theme-client",
		"smss-ui-theme-harness",
		"smss-ui-theme-playground",
		"smss-ui-theme-code",
		"smss-ui-theme-terminal",
		"smss-ui-theme-collaboration",
		"automation-theme",
	];
	const CHOICES = ["light", "dark", "system"];
	const LABELS = { light: "Light", dark: "Dark", system: "System" };

	const read = (key) => {
		try {
			return window.localStorage.getItem(key);
		} catch {
			return null;
		}
	};
	const write = (key, value) => {
		try {
			window.localStorage.setItem(key, value);
		} catch {
			// Storage can be blocked; the theme still applies for this page.
		}
	};
	const isChoice = (value) => CHOICES.includes(value);

	if (read(OFF_KEY) === "off") {
		const link = document.getElementById("bi-skin-css");
		if (link) {
			link.remove();
		}
		return;
	}

	/** The stored choice, adopting one from an older key when the shared key is empty. */
	const readChoice = () => {
		const stored = read(THEME_KEY);
		if (isChoice(stored)) {
			return stored;
		}
		for (const key of LEGACY_KEYS) {
			const legacy = read(key);
			if (isChoice(legacy)) {
				write(THEME_KEY, legacy);
				return legacy;
			}
		}
		return "system";
	};

	const media = window.matchMedia("(prefers-color-scheme: dark)");
	let choice = readChoice();

	const apply = () => {
		const dark =
			choice === "dark" || (choice === "system" && media.matches);
		document.documentElement.setAttribute(
			"data-theme",
			dark ? "dark" : "light",
		);
	};

	apply();

	window.addEventListener("storage", (event) => {
		if (event.key === THEME_KEY && isChoice(event.newValue)) {
			choice = event.newValue;
			apply();
			syncSelect();
		}
	});
	media.addEventListener("change", () => {
		if (choice === "system") {
			apply();
		}
	});

	let select = null;

	const syncSelect = () => {
		if (select) {
			select.value = choice;
		}
	};

	const onLoginScreen = () => /^#!\/login/.test(window.location.hash);

	/** A theme switch, shown only on the sign-in screen where BI has no menu to hold one. */
	const showSwitch = () => {
		if (!document.body) {
			return;
		}
		if (!onLoginScreen()) {
			if (select) {
				select.remove();
				select = null;
			}
			return;
		}
		if (select) {
			return;
		}
		select = document.createElement("select");
		select.className = "bi-skin-theme";
		select.setAttribute("aria-label", "Theme");
		for (const value of CHOICES) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = LABELS[value];
			select.append(option);
		}
		select.value = choice;
		select.addEventListener("change", () => {
			if (isChoice(select.value)) {
				choice = select.value;
				write(THEME_KEY, choice);
				apply();
			}
		});
		document.body.append(select);
	};

	document.addEventListener("DOMContentLoaded", showSwitch);
	window.addEventListener("hashchange", showSwitch);
})();
