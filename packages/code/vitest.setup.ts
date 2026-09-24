import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom doesn't implement ResizeObserver — use a class so it works as a constructor
global.ResizeObserver = class {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
};
