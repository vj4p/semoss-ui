import { useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "@semoss/i18n";
import { ConsoleLoader } from "@/components";

/**
 * The console, in the room the URL names, or in a new room.
 *
 * One page for both, with the room read from the child route, so that the
 * URL moving from a new room to the one its first prompt created does not
 * mount the page again and stop the run that prompt started.
 *
 * Trying again after a failure mounts the loader again, so that the
 * harnesses are fetched again as well as the models.
 *
 * The page scrolls only when zoom leaves too little height for the console's
 * regions, so that none of them is cut off. Otherwise the transcript is what
 * scrolls.
 *
 * @name ConsolePage
 */
export const ConsolePage = () => {
	const { t } = useTranslation("code");
	const { roomId } = useParams();
	const [attempt, setAttempt] = useState(0);

	return (
		<main className="flex h-full flex-col overflow-y-auto bg-background font-mono text-base text-foreground md:text-sm">
			<h1 className="sr-only">{t("title")}</h1>
			<ConsoleLoader
				key={attempt}
				roomId={roomId}
				onRetry={() => setAttempt((count) => count + 1)}
			/>
		</main>
	);
};
