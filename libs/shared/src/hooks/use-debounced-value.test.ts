import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./use-debounced-value";

describe("useDebouncedValue", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns initial value immediately", () => {
		const { result } = renderHook(() => useDebouncedValue("hello", 300));

		expect(result.current).toBe("hello");
	});

	it("debounces value changes", () => {
		const { result, rerender } = renderHook(
			({ value }) => useDebouncedValue(value, 300),
			{ initialProps: { value: "initial" } },
		);

		// Change value
		rerender({ value: "changed" });

		// Should not update immediately
		expect(result.current).toBe("initial");

		// Advance timers
		vi.advanceTimersByTime(300);

		// Should update after delay
		waitFor(() => {
			expect(result.current).toBe("changed");
		});
	});

	it("cancels pending update on rapid changes", () => {
		const { result, rerender } = renderHook(
			({ value }) => useDebouncedValue(value, 300),
			{ initialProps: { value: "initial" } },
		);

		// Rapid changes
		rerender({ value: "change1" });
		vi.advanceTimersByTime(100);
		rerender({ value: "change2" });
		vi.advanceTimersByTime(100);
		rerender({ value: "final" });

		// Only final value should be applied after full delay
		vi.advanceTimersByTime(300);

		waitFor(() => {
			expect(result.current).toBe("final");
		});
	});

	it("cleans up on unmount", () => {
		const { unmount } = renderHook(() => useDebouncedValue("test", 300));

		// Should not throw on unmount with pending timeout
		expect(() => unmount()).not.toThrow();
	});
});
