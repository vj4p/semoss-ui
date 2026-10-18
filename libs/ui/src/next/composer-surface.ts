/**
 * The surface of the chat composer in every app that has one. Harness and
 * Playground keep separate composer code, so this one string keeps them looking
 * like one product. Callers add their own sizing with `cn()`.
 */
export const composerSurfaceClass =
	"flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30";
