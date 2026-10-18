import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolStore } from "@/stores";
import { ReviewApprovalButton } from "./review-approval-button";

vi.mock("@semoss/i18n", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

const fakeTool = (isOpen = false) =>
	({ isOpen, openTool: vi.fn() }) as unknown as ToolStore & {
		openTool: ReturnType<typeof vi.fn>;
	};

describe("ReviewApprovalButton", () => {
	it("opens the tool in the side panel on desktop", () => {
		const tool = fakeTool();
		render(<ReviewApprovalButton tool={tool} isMobile={false} />);
		fireEvent.click(
			screen.getByRole("button", { name: "actions.reviewAndApprove" }),
		);
		expect(tool.openTool).toHaveBeenCalledWith("sidebar");
	});

	it("opens it inline on a small screen", () => {
		const tool = fakeTool();
		render(<ReviewApprovalButton tool={tool} isMobile />);
		fireEvent.click(
			screen.getByRole("button", { name: "actions.reviewAndApprove" }),
		);
		expect(tool.openTool).toHaveBeenCalledWith("inline");
	});

	it("does not trigger the row's own click", () => {
		const tool = fakeTool();
		const onRowClick = vi.fn();
		render(
			// biome-ignore lint/a11y/noStaticElementInteractions: test wrapper standing in for the row
			// biome-ignore lint/a11y/useKeyWithClickEvents: test wrapper standing in for the row
			<div onClick={onRowClick}>
				<ReviewApprovalButton tool={tool} isMobile={false} />
			</div>,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "actions.reviewAndApprove" }),
		);
		expect(onRowClick).not.toHaveBeenCalled();
	});

	it("is hidden once the tool is open, since the panel is the approval surface", () => {
		const { container } = render(
			<ReviewApprovalButton tool={fakeTool(true)} isMobile={false} />,
		);
		expect(container.firstChild).toBeNull();
	});
});
