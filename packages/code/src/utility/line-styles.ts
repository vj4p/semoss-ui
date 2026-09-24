import type { Emphasis, ItemStatus } from "@semoss/agent-core";

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

/**
 * The classes for an item's status glyph. The glyph's shape carries the
 * status and a visually hidden word names it, so the colour only repeats it.
 *
 * Each colour still measures 3:1 or more against the background, which a
 * glyph someone needs to see must. The warning colour does only on the dark
 * theme (2.2:1 on the light one), so a glyph waiting for the user is in the
 * foreground colour there instead.
 */
export const STATUS_CLASS: Readonly<Record<ItemStatus, string>> = {
	QUEUED: "text-muted-foreground",
	SUBMITTED: "text-muted-foreground",
	RUNNING: "text-primary motion-safe:animate-pulse",
	INPUT_REQUIRED: "text-foreground dark:text-warning",
	COMPLETED: "text-success",
	FAILED: "text-destructive",
	REJECTED: "text-muted-foreground",
	CANCELLED: "text-muted-foreground",
};
