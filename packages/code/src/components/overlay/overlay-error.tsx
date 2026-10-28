import { CircleAlertIcon } from "lucide-react";
import { useTranslation } from "@semoss/i18n";
import { Alert, AlertDescription, AlertTitle, Button } from "@semoss/ui/next";

/**
 * What an overlay shows when its read failed: the reason, and a way to try
 * again. `Alert` is announced as it appears, so no extra live region is needed.
 *
 * @name OverlayError
 * @param props.error - What went wrong.
 * @param props.onRetry - Called when the user asks to try again.
 */
export const OverlayError = ({
	error,
	onRetry,
}: {
	error: Error;
	onRetry: () => void;
}) => {
	const { t } = useTranslation("code");
	return (
		<Alert variant="destructive">
			<CircleAlertIcon aria-hidden="true" />
			<AlertTitle>{t("overlay.loadFailed")}</AlertTitle>
			<AlertDescription>
				<p>{error.message}</p>
				<Button variant="outline" size="sm" onClick={onRetry}>
					{t("overlay.retry")}
				</Button>
			</AlertDescription>
		</Alert>
	);
};
