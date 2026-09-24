import { isRouteErrorResponse, useRouteError } from "react-router";
import { describeError } from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";
import { Alert, AlertTitle, Button } from "@semoss/ui/next";

/** What went wrong, in the words it came with, if it came with any. */
const errorMessage = (error: unknown): string | undefined => {
	if (error === undefined || error === null) {
		return undefined;
	}
	if (isRouteErrorResponse(error)) {
		return `${error.status} ${error.statusText}`.trim();
	}
	return describeError(error);
};

/**
 * The page for an error nothing else caught: in a route, or while the
 * platform session was being set up.
 *
 * The reason sits in a plain block rather than an `AlertDescription`, for the
 * contrast reason `ConsoleFailure` gives. The page is centred while the alert
 * fits and scrolls from the top once it does not, as a long reason can at
 * 200% zoom.
 *
 * @name ErrorPage
 * @param props.error - The error, when it did not come from a route.
 */
export const ErrorPage = ({ error }: { error?: unknown }) => {
	const { t } = useTranslation("code");
	const routeError = useRouteError();
	const message = errorMessage(error ?? routeError);

	return (
		<main className="items-center-safe justify-center-safe flex h-full overflow-y-auto bg-background p-6 text-foreground">
			<h1 className="sr-only">{t("title")}</h1>
			<Alert variant="destructive" className="max-w-lg">
				<AlertTitle>{t("error.title")}</AlertTitle>
				<div className="col-start-2 grid justify-items-start gap-3">
					<p>{t("error.description")}</p>
					{message !== undefined && (
						<p
							className="whitespace-pre-wrap break-words font-mono text-xs"
							dir="auto"
						>
							{message}
						</p>
					)}
					<Button
						size="sm"
						variant="outline"
						onClick={() => window.location.reload()}
						data-testid="errorPage-reload-button"
					>
						{t("error.reload")}
					</Button>
				</div>
			</Alert>
		</main>
	);
};
