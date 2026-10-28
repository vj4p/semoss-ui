import { act, renderHook, waitFor } from "@testing-library/react";
import { useCallback } from "react";
import { describe, expect, it, vi } from "vitest";
import { useOverlayQuery } from "./use-overlay-query";

/** A promise the test settles by hand, to control the order answers arrive in. */
const deferred = <T,>() => {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

describe("useOverlayQuery", () => {
	it("is loading, then ready with the answer", async () => {
		const load = () => Promise.resolve("answer");
		const { result } = renderHook(() => useOverlayQuery(true, load));
		expect(result.current.state.status).toBe("loading");
		await waitFor(() => expect(result.current.state.status).toBe("ready"));
		expect(result.current.state).toEqual({
			status: "ready",
			data: "answer",
		});
	});

	it("reads once when enabled and not at all while disabled", async () => {
		const load = vi.fn(() => Promise.resolve(1));
		const { result, rerender } = renderHook(
			({ enabled }) => useOverlayQuery(enabled, load),
			{ initialProps: { enabled: false } },
		);
		expect(load).not.toHaveBeenCalled();
		rerender({ enabled: true });
		await waitFor(() => expect(result.current.state.status).toBe("ready"));
		expect(load).toHaveBeenCalledTimes(1);
		expect(result.current.state).toEqual({ status: "ready", data: 1 });
	});

	it("turns a rejection into an error and reads again on reload", async () => {
		const load = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error("boom"))
			.mockResolvedValueOnce("fine");
		const { result } = renderHook(() => useOverlayQuery(true, load));
		await waitFor(() => expect(result.current.state.status).toBe("error"));
		expect(result.current.state).toMatchObject({
			error: { message: "boom" },
		});
		act(() => result.current.reload());
		await waitFor(() => expect(result.current.state.status).toBe("ready"));
		expect(result.current.state).toEqual({ status: "ready", data: "fine" });
		expect(load).toHaveBeenCalledTimes(2);
	});

	it("wraps a rejection that is not an Error", async () => {
		const load = () => Promise.reject("plain string");
		const { result } = renderHook(() => useOverlayQuery(true, load));
		await waitFor(() => expect(result.current.state.status).toBe("error"));
		expect(result.current.state).toMatchObject({
			error: { message: "plain string" },
		});
	});

	it("drops a late answer to an earlier read", async () => {
		const first = deferred<string>();
		const second = deferred<string>();
		const loads = [first, second];
		const { result, rerender } = renderHook(
			({ room }: { room: number }) => {
				const load = useCallback(() => loads[room].promise, [room]);
				return useOverlayQuery(true, load);
			},
			{ initialProps: { room: 0 } },
		);
		// the room changes, so the hook reads again; then the first read answers late
		rerender({ room: 1 });
		await act(async () => {
			second.resolve("second");
			await second.promise;
		});
		await act(async () => {
			first.resolve("first");
			await first.promise;
		});
		expect(result.current.state).toEqual({
			status: "ready",
			data: "second",
		});
	});

	it("does not update after unmount", async () => {
		const pending = deferred<string>();
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const load = () => pending.promise;
		const { unmount } = renderHook(() => useOverlayQuery(true, load));
		unmount();
		await act(async () => {
			pending.resolve("late");
			await pending.promise;
		});
		expect(errors).not.toHaveBeenCalled();
		errors.mockRestore();
	});
});
