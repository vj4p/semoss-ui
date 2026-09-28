import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APPROVAL_KEY_DELAY_MS } from "@semoss/agent-core";
import type { PendingAgentAction } from "@semoss/sdk/react";
import { useReadyApproval } from "./use-ready-approval";

const action = (actionId: string): PendingAgentAction => ({
	actionId,
	runId: "run-1",
	parentMessageId: null,
	toolCallId: null,
	toolName: "Bash",
	toolArgs: {},
	editedArgs: null,
	toolMeta: null,
	hasUi: false,
	uiUrl: null,
	status: "PENDING",
});

const mount = (keyed: PendingAgentAction | undefined) =>
	renderHook((props) => useReadyApproval(props.keyed), {
		initialProps: { keyed },
	});

const wait = (ms: number) => {
	act(() => {
		vi.advanceTimersByTime(ms);
	});
};

describe("useReadyApproval", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("gives the call once it has been on screen for the delay, and not before", () => {
		const call = action("a-1");
		const { result } = mount(call);
		expect(result.current).toBeUndefined();
		wait(APPROVAL_KEY_DELAY_MS - 1);
		expect(result.current).toBeUndefined();
		wait(1);
		expect(result.current).toBe(call);
	});

	it("starts the delay again for a new call", () => {
		const { result, rerender } = mount(action("a-1"));
		wait(APPROVAL_KEY_DELAY_MS);
		const next = action("a-2");
		rerender({ keyed: next });
		expect(result.current).toBeUndefined();
		wait(APPROVAL_KEY_DELAY_MS - 1);
		expect(result.current).toBeUndefined();
		wait(1);
		expect(result.current).toBe(next);
	});

	it("starts it again when the same call comes back", () => {
		const call = action("a-1");
		const { result, rerender } = mount(call);
		wait(APPROVAL_KEY_DELAY_MS);
		rerender({ keyed: undefined });
		rerender({ keyed: call });
		expect(result.current).toBeUndefined();
		wait(APPROVAL_KEY_DELAY_MS);
		expect(result.current).toBe(call);
	});

	it("keeps a ready call ready when a poll brings it back as a new object", () => {
		const { result, rerender } = mount(action("a-1"));
		wait(APPROVAL_KEY_DELAY_MS);
		const again = action("a-1");
		rerender({ keyed: again });
		expect(result.current).toBe(again);
	});

	it("gives nothing while no call is waiting", () => {
		const { result } = mount(undefined);
		wait(APPROVAL_KEY_DELAY_MS * 2);
		expect(result.current).toBeUndefined();
	});
});
