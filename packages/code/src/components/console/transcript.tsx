import { useLayoutEffect, useRef } from "react";
import type { SessionEntry, Translate } from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";
import { useLineLabels } from "@/hooks";
import { EntryView } from "./line-view";

/** How near the bottom, in pixels, still counts as reading the latest line. */
const STICK_DISTANCE = 32;

/**
 * The session's entries, oldest first, in a log that scrolls on its own.
 *
 * The log keeps to its last line while the user is reading there, and stays
 * where it is once they scroll up to read something earlier. A new entry,
 * which is always something the user just did, brings it back down.
 *
 * It is not a live region: every line of a streaming run would be read out.
 * The console's announcer says what is worth hearing instead. It can take
 * focus, so that keyboard users can scroll it. Its focus outline is in the
 * foreground colour, because the ring colour measures 2.5:1 against the
 * light theme's background, under the 3:1 a focus indicator needs.
 *
 * However little height the console has, the log keeps a few lines of it.
 *
 * @name Transcript
 * @param props.entries - The session's entries.
 * @param props.translate - Translate for the lines agent-core writes.
 */
export const Transcript = ({
	entries,
	translate,
}: {
	entries: readonly SessionEntry[];
	translate: Translate;
}) => {
	const { t } = useTranslation("code");
	const labels = useLineLabels();
	const logRef = useRef<HTMLDivElement>(null);
	const stickRef = useRef(true);
	const lastIdRef = useRef<string | undefined>(undefined);

	useLayoutEffect(() => {
		const log = logRef.current;
		if (log === null) {
			return;
		}
		const lastId = entries.at(-1)?.id;
		if (lastId !== lastIdRef.current) {
			lastIdRef.current = lastId;
			stickRef.current = true;
		}
		if (stickRef.current) {
			log.scrollTop = log.scrollHeight;
		}
	}, [entries]);

	const onScroll = () => {
		const log = logRef.current;
		if (log !== null) {
			stickRef.current =
				log.scrollHeight - log.scrollTop - log.clientHeight <=
				STICK_DISTANCE;
		}
	};

	return (
		<div
			ref={logRef}
			role="log"
			aria-live="off"
			aria-label={t("transcript.label")}
			// biome-ignore lint/a11y/noNoninteractiveTabindex: focusable by design so keyboard users can scroll the transcript
			tabIndex={0}
			onScroll={onScroll}
			className="focus-visible:-outline-offset-2 min-h-24 flex-1 overflow-y-auto p-4 focus-visible:outline-2 focus-visible:outline-foreground md:p-6"
			data-testid="transcript-log"
		>
			{entries.length === 0 ? (
				<p className="text-muted-foreground">
					{t("transcript.firstRun")}
				</p>
			) : (
				<div className="flex flex-col gap-4">
					{entries.map((entry) => (
						<EntryView
							key={entry.id}
							entry={entry}
							translate={translate}
							labels={labels}
						/>
					))}
				</div>
			)}
		</div>
	);
};
