import ReactDOM from "react-dom/client";
import { App, i18nReady } from "./app";
import "./index.css";

// biome-ignore lint/style/noNonNullAssertion: root element always exists in index.html
const root = ReactDOM.createRoot(document.getElementById("root")!);
void i18nReady.finally(() => root.render(<App />));
