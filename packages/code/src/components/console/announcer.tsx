import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Session, Translate } from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";
import { announcementsFor } from "@/utility";

/**
 * Messages kept in the region. Only the ones added are read out, so the rest
 * are there for a screen reader user who goes looking for what was said.
 */
const KEEP = 5;

/**
 * Says what a screen reader user needs to hear as the session changes: see
 * `announcementsFor` for what that is.
 *
 * It follows the session itself rather than what React last rendered, so
 * that a change React folds into another render is still heard. The region
 * is polite, and not a status role, whose container a screen reader may read
 * out whole each time something is added to it.
 *
 * @name Announcer
 * @param props.session - The session to follow.
 * @param props.translate - Translate for agent-core's messages.
 */
export const Announcer = ({
	session,
	translate,
}: {
	session: Session;
	translate: Translate;
}) => {
	const { t } = useTranslation("code");
	const [messages, setMessages] = useState<
		readonly { id: number; text: string }[]
	>([]);
	const lastIdRef = useRef(0);
	const latest = useRef({ translate, completed: t("announce.completed") });

	useLayoutEffect(() => {
		latest.current = { translate, completed: t("announce.completed") };
	});

	useEffect(() => {
		let previous = session.getState();
		return session.subscribe(() => {
			const next = session.getState();
			const { translate, completed } = latest.current;
			const said = announcementsFor(previous, next, translate, completed);
			previous = next;
			if (said.length > 0) {
				setMessages((current) =>
					[
						...current,
						...said.map((text) => ({
							id: ++lastIdRef.current,
							text,
						})),
					].slice(-KEEP),
				);
			}
		});
	}, [session]);

	return (
		<div
			className="sr-only"
			aria-live="polite"
			aria-relevant="additions"
			data-testid="announcer-region"
		>
			{messages.map((message) => (
				// sr-only sets nowrap, which would run a notice's lines together.
				<p key={message.id} className="whitespace-pre-line">
					{message.text}
				</p>
			))}
		</div>
	);
};
