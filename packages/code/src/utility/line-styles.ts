import type { Emphasis, ItemStatus } from "@semoss/agent-core";
import { STATUS_TEXT_CLASS, type StatusKind } from "@semoss/ui/next";

/**
 * The classes each emphasis agent-core puts on a segment.
 *
 * They add weight, never meaning: the words of every emphasised segment say
 * what it is. Accent is set in the foreground colour rather than primary,
 * which measures 4.3:1 on the dark theme's background, under the 4.5:1 that
 * text this size needs.
 */
export const EMPHASIS_CLASS: Readonly<Record<Emphasis, string>> = {
	dim: "text-muted-foreground",
	bold: "font-bold",
	error: "text-destructive",
	accent: "font-semibold text-foreground",
	path: "font-medium text-foreground",
	code: "rounded-sm bg-muted px-1 text-foreground",
};

/**
 * Whether a segment is always left to right: a file name or a key chord keeps
 * its own order inside an Arabic sentence.
 *
 * @name isLeftToRight
 * @param emphasis - The segment's emphasis.
 * @return True for paths and code.
 */
export const isLeftToRight = (emphasis?: Emphasis): boolean =>
	emphasis === "path" || emphasis === "code";

const ITEM_STATUS_KIND: Readonly<Record<ItemStatus, StatusKind>> = {
	QUEUED: "queued",
	SUBMITTED: "queued",
	RUNNING: "running",
	INPUT_REQUIRED: "waiting",
	COMPLETED: "done",
	FAILED: "failed",
	REJECTED: "denied",
	CANCELLED: "cancelled",
};

/**
 * The classes for an item's status glyph. The glyph's shape carries the
 * status and a visually hidden word names it, so the colour only repeats it.
 * The colours are the shared status colours, each at least 4.5:1 on both themes.
 */
export const STATUS_CLASS: Readonly<Record<ItemStatus, string>> =
	Object.fromEntries(
		Object.entries(ITEM_STATUS_KIND).map(([status, kind]) => [
			status,
			STATUS_TEXT_CLASS[kind],
		]),
	) as Record<ItemStatus, string>;
