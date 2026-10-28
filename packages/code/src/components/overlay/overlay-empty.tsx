import type { ReactNode } from "react";
import { Muted, P } from "@semoss/ui/next";

/**
 * What an overlay shows when its read worked and there is nothing in it: a
 * title, a line on what to do about that, and optionally one action.
 *
 * @name OverlayEmpty
 * @param props.title - What is missing.
 * @param props.description - Why, or what to do.
 * @param props.children - An action, when there is one.
 */
export const OverlayEmpty = ({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children?: ReactNode;
}) => (
	<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
		<P className="font-medium text-sm">{title}</P>
		{description ? <Muted>{description}</Muted> : null}
		{children}
	</div>
);
