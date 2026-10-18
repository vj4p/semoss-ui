// Run with: node --test skins/bi/skin.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const here = (file) => new URL(file, import.meta.url);
const css = readFileSync(here("./bi-skin.css"), "utf8");
const script = readFileSync(here("./bi-skin.js"), "utf8");

/** Every variable BI's own stylesheet defines on :root. */
const BI_VARIABLES = [
	"--color-primary-100",
	"--color-primary-70",
	"--color-primary-50",
	"--color-primary-30",
	"--color-primary-10",
	"--color-warn-100",
	"--color-warn-70",
	"--color-warn-30",
	"--color-warn-10",
	"--color-error-100",
	"--color-error-70",
	"--color-error-30",
	"--color-error-10",
	"--color-success-100",
	"--color-success-70",
	"--color-success-30",
	"--color-success-10",
	"--color-grey-1",
	"--color-grey-2",
	"--color-grey-3",
	"--color-grey-4",
	"--color-grey-5",
	"--color-grey-6",
	"--color-white",
	"--color-shadow",
	"--color-backdrop",
	"--font-family",
];

/** The declarations inside the first block whose selector is exactly `selector`. */
const readBlock = (selector) => {
	const start = css.indexOf(`${selector} {`);
	assert.notEqual(start, -1, `no ${selector} block in bi-skin.css`);
	const body = css.slice(start, css.indexOf("}", start));
	const tokens = {};
	for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
		tokens[match[1]] = match[2].trim();
	}
	return tokens;
};

const light = readBlock("html:root");

test("the light block sets the font BI reads", () => {
	assert.ok(light["--font-family"]);
});
const dark = readBlock('html[data-theme="dark"]:root');

const channel = (c) => {
	const s = c / 255;
	return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
	const n = Number.parseInt(hex.slice(1), 16);
	return (
		0.2126 * channel((n >> 16) & 255) +
		0.7152 * channel((n >> 8) & 255) +
		0.0722 * channel(n & 255)
	);
};
const contrast = (a, b) => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

/** [foreground, background, minimum ratio]. */
const PAIRS = [
	// body text and secondary text on both surfaces BI uses
	["--color-grey-1", "--color-white", 4.5],
	["--color-grey-1", "--color-grey-6", 4.5],
	["--color-grey-2", "--color-white", 4.5],
	["--color-grey-2", "--color-grey-6", 4.5],
	["--color-grey-3", "--color-white", 4.5],
	["--color-grey-3", "--color-grey-6", 4.5],
	// links, headings and the focus ring in the primary color
	["--color-primary-100", "--color-white", 4.5],
	["--color-primary-100", "--color-grey-6", 4.5],
	["--color-primary-100", "--color-primary-10", 4.5],
	["--color-primary-70", "--color-white", 4.5],
	["--color-primary-70", "--color-primary-10", 4.5],
	// text on filled buttons, which BI draws in --color-white
	["--color-white", "--color-primary-100", 4.5],
	["--color-white", "--color-primary-70", 4.5],
	["--color-white", "--color-error-100", 4.5],
	["--color-white", "--color-success-100", 4.5],
	["--color-white", "--color-warn-100", 4.5],
	// status text on the page and on its own tint
	["--color-error-100", "--color-white", 4.5],
	["--color-success-100", "--color-white", 4.5],
	["--color-warn-100", "--color-white", 4.5],
	["--color-error-100", "--color-error-10", 4.5],
	["--color-success-100", "--color-success-10", 4.5],
	["--color-warn-100", "--color-warn-10", 4.5],
];

for (const [name, tokens] of [
	["light", light],
	["dark", dark],
]) {
	test(`${name} theme defines every color variable BI reads`, () => {
		// The font does not change with the theme, so only the light block sets it.
		const required = BI_VARIABLES.filter((v) => v !== "--font-family");
		for (const variable of required) {
			assert.ok(tokens[variable], `${name}: ${variable} is not defined`);
		}
	});

	for (const [fg, bg, min] of PAIRS) {
		test(`${name}: ${fg} on ${bg} is at least ${min}:1`, () => {
			const ratio = contrast(tokens[fg], tokens[bg]);
			assert.ok(
				ratio >= min,
				`${tokens[fg]} on ${tokens[bg]} is ${ratio.toFixed(2)}:1`,
			);
		});
	}
}

test("light islands keep exactly the light palette", () => {
	const island = readBlock(
		[
			'html[data-theme="dark"] .home__topbar,',
			'html[data-theme="dark"] .home-intro__content__cards__card,',
			'html[data-theme="dark"] .home-intro .smss-overlay__wrapper__header,',
			'html[data-theme="dark"] .ag-theme-balham',
		].join("\n"),
	);
	for (const variable of BI_VARIABLES.filter((v) => v !== "--font-family")) {
		assert.equal(island[variable], light[variable], `island ${variable}`);
	}
});

test("the welcome banner text reaches AA on both gradient stops", () => {
	for (const stop of ["#6d3fc4", "#0560d8"]) {
		const ratio = contrast("#ffffff", stop);
		assert.ok(ratio >= 4.5, `white on ${stop} is ${ratio.toFixed(2)}:1`);
	}
});

test("loads Geist from the skin's own files, not a CDN", () => {
	assert.ok(css.includes("fonts/geist-latin-wght-normal.woff2"));
	assert.ok(!css.includes("fonts.googleapis.com"));
});

test("gives keyboard focus a visible outline in the primary color", () => {
	assert.match(
		css,
		/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-primary-100\)/,
	);
});

/** Runs bi-skin.js against a fake browser and returns what it did. */
const run = ({ stored, prefersDark = false, hash = "#!/login" }) => {
	const store = new Map(stored ? Object.entries(stored) : []);
	const listeners = {};
	const attributes = {};
	const removed = [];
	const toggles = [];
	const document = {
		documentElement: {
			setAttribute: (k, v) => {
				attributes[k] = v;
			},
			style: {},
		},
		getElementById: (id) =>
			id === "bi-skin-css" ? { remove: () => removed.push(id) } : null,
		addEventListener: () => undefined,
		readyState: "loading",
		body: null,
		createElement: () => ({
			setAttribute: () => undefined,
			style: {},
			addEventListener: () => undefined,
			append: () => undefined,
		}),
	};
	const window = {
		document,
		location: { hash },
		localStorage: {
			getItem: (k) => (store.has(k) ? store.get(k) : null),
			setItem: (k, v) => store.set(k, v),
		},
		matchMedia: () => ({
			matches: prefersDark,
			addEventListener: (type, fn) => {
				listeners[`media:${type}`] = fn;
			},
		}),
		addEventListener: (type, fn) => {
			listeners[type] = fn;
		},
		__toggles: toggles,
	};
	vm.runInNewContext(script, {
		window,
		document,
		localStorage: window.localStorage,
	});
	return { attributes, store, listeners, removed, window };
};

test("follows the platform's stored dark choice", () => {
	assert.equal(
		run({ stored: { "smss-ui-theme": "dark" } }).attributes["data-theme"],
		"dark",
	);
});

test("follows the platform's stored light choice even on a dark OS", () => {
	const result = run({
		stored: { "smss-ui-theme": "light" },
		prefersDark: true,
	});
	assert.equal(result.attributes["data-theme"], "light");
});

test("follows the OS for system and for no choice", () => {
	assert.equal(
		run({ stored: { "smss-ui-theme": "system" }, prefersDark: true })
			.attributes["data-theme"],
		"dark",
	);
	assert.equal(run({ prefersDark: true }).attributes["data-theme"], "dark");
	assert.equal(run({ prefersDark: false }).attributes["data-theme"], "light");
});

test("ignores a stored value that is not a theme", () => {
	assert.equal(
		run({ stored: { "smss-ui-theme": "purple" } }).attributes["data-theme"],
		"light",
	);
});

test("adopts the client's old key like every other app does", () => {
	const result = run({ stored: { "smss-ui-theme-client": "dark" } });
	assert.equal(result.attributes["data-theme"], "dark");
	assert.equal(result.store.get("smss-ui-theme"), "dark");
});

test("changes theme when another tab changes the shared choice", () => {
	const result = run({ stored: { "smss-ui-theme": "light" } });
	result.listeners.storage({ key: "smss-ui-theme", newValue: "dark" });
	assert.equal(result.attributes["data-theme"], "dark");
});

test("can be switched off without touching the app", () => {
	const result = run({
		stored: { "smss-bi-skin": "off", "smss-ui-theme": "dark" },
	});
	assert.deepEqual(result.removed, ["bi-skin-css"]);
	assert.equal(result.attributes["data-theme"], undefined);
});
