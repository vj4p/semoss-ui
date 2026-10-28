import { useTranslation } from "@semoss/i18n";
import { Spinner } from "@semoss/ui/next";

/** What an overlay shows while its read is running. The spinner is a status, so it is announced. */
export const OverlayLoading = () => {
	const { t } = useTranslation("code");
	return (
		<div className="flex items-center justify-center py-12">
			<Spinner aria-label={t("overlay.loading")} />
		</div>
	);
};
