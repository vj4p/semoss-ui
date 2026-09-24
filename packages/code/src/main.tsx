import ReactDOM from "react-dom/client";
import { waitForEmbedAuth } from "@semoss/sdk/react";
import { App, i18nReady } from "./app";
import "./index.css";

const container = document.getElementById("root");
if (container === null) {
	throw new Error("SEMOSS Code has no #root element to render into");
}
const root = ReactDOM.createRoot(container);

const mount = async () => {
	// An embedded instance receives its bearer token from the parent frame via
	// postMessage, and rendering before it arrives fires the first pixel calls
	// unauthenticated. Resolves immediately when not embedded.
	await Promise.all([waitForEmbedAuth(), i18nReady]);
	root.render(<App />);
};

void mount();
