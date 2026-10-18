import { observer } from "mobx-react-lite";
import { useTranslation } from "@semoss/i18n";
import { Button } from "@semoss/ui/next";
import type { ToolStore } from "@/stores";

export interface ReviewApprovalButtonProps {
	/** A tool call that is waiting for the person to approve it. */
	tool: ToolStore;
	isMobile: boolean;
}

/**
 * Points a person at where a waiting tool call is approved. It only opens the
 * tool, whose panel holds Execute Tool and Cancel, so it decides nothing. Once
 * the tool is open the panel is in view and the button steps aside.
 */
export const ReviewApprovalButton = observer(
	({ tool, isMobile }: ReviewApprovalButtonProps) => {
		const { t } = useTranslation("tool");

		if (tool.isOpen) {
			return null;
		}

		return (
			<Button
				type="button"
				size="sm"
				variant="outline"
				className="me-2 shrink-0"
				onClick={(e) => {
					e.stopPropagation();
					tool.openTool(isMobile ? "inline" : "sidebar");
				}}
			>
				{t("actions.reviewAndApprove")}
			</Button>
		);
	},
);
