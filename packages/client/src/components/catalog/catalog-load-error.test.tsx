import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogLoadError } from "./catalog-load-error";

afterEach(cleanup);

describe("CatalogLoadError", () => {
	it("announces that the list could not be loaded, naming what it lists", () => {
		render(<CatalogLoadError noun="agents" onRetry={() => undefined} />);
		const alert = screen.getByRole("alert");
		expect(alert).toHaveTextContent("Could not load agents");
	});

	it("asks for the list again when Try Again is pressed", () => {
		const onRetry = vi.fn();
		render(<CatalogLoadError noun="models" onRetry={onRetry} />);
		fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
		expect(onRetry).toHaveBeenCalledOnce();
	});
});
