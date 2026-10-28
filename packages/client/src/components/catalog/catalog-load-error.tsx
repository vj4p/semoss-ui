import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button } from "@semoss/ui/next";

export interface CatalogLoadErrorProps {
	/** What the catalog lists, plural and lower case, such as "agents" */
	noun: string;
	/** Ask for the list again */
	onRetry: () => void;
}

/**
 * What a catalog shows when its list could not be read, in place of the empty
 * state: a failed load is not "nothing here yet".
 */
export const CatalogLoadError = ({ noun, onRetry }: CatalogLoadErrorProps) => (
	<Alert variant="destructive">
		<CircleAlertIcon aria-hidden="true" />
		<AlertTitle>Could not load {noun}</AlertTitle>
		<AlertDescription>
			<p>Something went wrong while loading the list. Try again.</p>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="mt-2"
				onClick={onRetry}
			>
				Try Again
			</Button>
		</AlertDescription>
	</Alert>
);
