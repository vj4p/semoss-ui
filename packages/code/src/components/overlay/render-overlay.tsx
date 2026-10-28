import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { codeResources, I18nBuilder, I18nextProvider } from "@semoss/i18n";

/** English only, so a test can read what a user would. */
export const overlayI18n = new I18nBuilder(codeResources, {
	lockToEnglish: true,
});

/**
 * Render an overlay the way the console hosts it: inside the translation
 * provider and a router (the inbox links to rooms).
 *
 * @name renderOverlay
 * @param ui - The overlay, usually with `open` set.
 * @return Testing Library's render result.
 */
export const renderOverlay = (ui: ReactElement) =>
	render(
		<I18nextProvider i18n={overlayI18n.i18n}>
			<MemoryRouter>{ui}</MemoryRouter>
		</I18nextProvider>,
	);
