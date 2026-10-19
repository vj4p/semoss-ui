import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolStore } from "@/stores";
import { decideAgentToolAction } from "@/stores/message/agent-harness";
import { ToolsHarnessApprovalView } from "./tools-harness-approval-view";

vi.mock("@semoss/i18n", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/stores/message/agent-harness", () => ({
	decideAgentToolAction: vi.fn(async () => undefined),
}));

const decide = vi.mocked(decideAgentToolAction);

const fakeTool = (toolArgs: unknown, pending = true) =>
	({
		displayName: "Bash",
		pendingAction: pending
			? {
					actionId: "a1",
					runId: "r1",
					toolCallId: "c1",
					toolName: "Bash",
					toolArgs,
					toolMeta: { SMSS_HARNESS_NATIVE: "claude_code" },
				}
			: null,
	}) as unknown as ToolStore;

beforeEach(() => decide.mockClear());
afterEach(cleanup);

describe("ToolsHarnessApprovalView", () => {
	it("shows the command that will run", () => {
		render(
			<ToolsHarnessApprovalView
				tool={fakeTool({ command: "echo hi > approval-test.txt" })}
			/>,
		);
		expect(screen.getByText("Bash")).toBeTruthy();
		expect(screen.getByText("echo hi > approval-test.txt")).toBeTruthy();
	});

	it("shows the file for a write and the arguments for anything else", () => {
		const { unmount } = render(
			<ToolsHarnessApprovalView
				tool={fakeTool({ file_path: "src/a.ts", content: "x" })}
			/>,
		);
		expect(screen.getByText("src/a.ts")).toBeTruthy();
		unmount();
		render(
			<ToolsHarnessApprovalView tool={fakeTool({ url: "http://x" })} />,
		);
		expect(screen.getByText(/"url": "http:\/\/x"/)).toBeTruthy();
	});

	it("approves with the original arguments by sending none", async () => {
		render(<ToolsHarnessApprovalView tool={fakeTool({ command: "ls" })} />);
		fireEvent.click(
			screen.getByRole("button", { name: "harnessApproval.approve" }),
		);
		await waitFor(() => expect(decide).toHaveBeenCalledTimes(1));
		expect(decide.mock.calls[0][1]).toBe("submit");
		expect(decide.mock.calls[0][2]).toBeUndefined();
	});

	it("approves with edited arguments", async () => {
		render(
			<ToolsHarnessApprovalView
				tool={fakeTool({ command: "rm -rf build" })}
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", {
				name: "harnessApproval.editArguments",
			}),
		);
		fireEvent.change(screen.getByLabelText("harnessApproval.arguments"), {
			target: { value: '{"command":"rm -rf build/tmp"}' },
		});
		fireEvent.click(
			screen.getByRole("button", { name: "harnessApproval.approve" }),
		);
		await waitFor(() => expect(decide).toHaveBeenCalledTimes(1));
		expect(decide.mock.calls[0][2]).toEqual({
			command: "rm -rf build/tmp",
		});
	});

	it("does not send invalid edited arguments", () => {
		render(<ToolsHarnessApprovalView tool={fakeTool({ command: "ls" })} />);
		fireEvent.click(
			screen.getByRole("button", {
				name: "harnessApproval.editArguments",
			}),
		);
		fireEvent.change(screen.getByLabelText("harnessApproval.arguments"), {
			target: { value: "{not json" },
		});
		fireEvent.click(
			screen.getByRole("button", { name: "harnessApproval.approve" }),
		);
		expect(screen.getByRole("alert").textContent).toBe(
			"harnessApproval.invalidJson",
		);
		expect(decide).not.toHaveBeenCalled();
	});

	it("rejects", async () => {
		render(<ToolsHarnessApprovalView tool={fakeTool({ command: "ls" })} />);
		fireEvent.click(
			screen.getByRole("button", { name: "harnessApproval.reject" }),
		);
		await waitFor(() => expect(decide).toHaveBeenCalledTimes(1));
		expect(decide.mock.calls[0][1]).toBe("reject");
	});

	it("shows that the decision was sent once nothing is pending, with no buttons", () => {
		render(
			<ToolsHarnessApprovalView
				tool={fakeTool({ command: "ls" }, false)}
			/>,
		);
		expect(screen.getByText("harnessApproval.decided")).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: "harnessApproval.approve" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "harnessApproval.reject" }),
		).toBeNull();
	});
});
