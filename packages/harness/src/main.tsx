import ReactDOM from "react-dom/client";
import { waitForEmbedAuth } from "@semoss/sdk/react";
import { App, i18nReady } from "./app";
import { initColorTheme } from "./hooks/use-color-theme";
import "./index.css";

// Apply the stored accent class before the first paint, otherwise the app
// renders with the default accent for a frame and visibly recolors.
initColorTheme();

// biome-ignore lint/style/noNonNullAssertion: root element always exists in index.html
const root = ReactDOM.createRoot(document.getElementById("root")!);

const mount = async () => {
	// The harness is embeddable (see pages/embed-page.tsx), and an embedded
	// instance receives its bearer token from the parent frame via postMessage.
	// Rendering before that arrives fires the first pixel calls unauthenticated.
	// Resolves immediately when not embedded.
	await Promise.all([waitForEmbedAuth(), i18nReady]);
	root.render(<App />);
};

void mount();
