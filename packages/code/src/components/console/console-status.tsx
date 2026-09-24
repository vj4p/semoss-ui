import { Alert, AlertTitle, Button, Spinner } from "@semoss/ui/next";

/**
 * The console's place while something it needs is loading. The spinner says
 * what, as a status a screen reader announces, so the visible words beside it
 * are hidden from one rather than read twice.
 *
 * @name ConsolePending
 * @param props.label - What is loading.
 */
export const ConsolePending = ({ label }: { label: string }) => (
	<div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
		<Spinner aria-label={label} className="size-6" />
		<p aria-hidden="true">{label}</p>
	</div>
);

/**
 * The console's place when something it needs could not be loaded: what
 * failed, why, and the way on.
 *
 * The reason sits in a plain block rather than an `AlertDescription`, whose
 * destructive colour at 90% measures 4.35:1 on the light theme's card, under
 * the 4.5:1 text this size needs. Here it takes the alert's own colour.
 *
 * @name ConsoleFailure
 * @param props.title - What failed.
 * @param props.message - Why, as the server or browser put it.
 * @param props.action - The label of the way on.
 * @param props.onAction - Takes the way on.
 */
export const ConsoleFailure = ({
	title,
	message,
	action,
	onAction,
}: {
	title: string;
	message: string;
	action: string;
	onAction: () => void;
}) => (
	<div className="flex flex-1 items-center justify-center p-6">
		<Alert variant="destructive" className="max-w-lg">
			<AlertTitle>{title}</AlertTitle>
			<div className="col-start-2 grid justify-items-start gap-3">
				<p className="whitespace-pre-wrap break-words" dir="auto">
					{message}
				</p>
				<Button
					size="sm"
					variant="outline"
					onClick={onAction}
					data-testid="consoleStatus-action-button"
				>
					{action}
				</Button>
			</div>
		</Alert>
	</div>
);
