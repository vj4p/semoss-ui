import { Outlet } from "react-router";
import { useTranslation } from "@semoss/i18n";
import { useInsight } from "@semoss/sdk/react";
import { Spinner } from "@semoss/ui/next";
import { ErrorPage } from "./error.page";

/**
 * Holds every route until the platform session is set up, and shows the
 * error page if it could not be.
 *
 * @name InitializedLayout
 */
export const InitializedLayout = () => {
	const { t } = useTranslation("code");
	const { isInitialized, error } = useInsight();

	if (error) {
		return <ErrorPage error={error} />;
	}
	if (!isInitialized) {
		return (
			<div className="flex h-full items-center justify-center bg-background text-muted-foreground">
				<Spinner aria-label={t("loading")} className="size-6" />
			</div>
		);
	}
	return <Outlet />;
};
