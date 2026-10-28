/**
 * Read a timestamp the platform database returned.
 *
 * Agent run and action rows come back as `2026-09-12 03:47:56.368990`, with no
 * zone. The server writes them in its own clock, which is UTC in every container
 * the platform ships in, so a value with no zone is read as UTC. Reading it as
 * local time would put every run hours off for anyone not on the server's clock.
 */
export const parseServerTime = (value: unknown): Date | undefined => {
	if (typeof value !== "string") {
		return undefined;
	}
	const match = value
		.trim()
		.match(
			/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?$/,
		);
	if (!match) {
		return undefined;
	}
	const [, day, time, fraction = "", zone = "Z"] = match;
	// Date only reads milliseconds; the database writes microseconds.
	const millis = fraction.slice(0, 3).padEnd(3, "0");
	const parsed = new Date(`${day}T${time}.${millis}${zone}`);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

/** How long ago, in the words the overlays use. */
export const formatAgo = (then: Date, now: Date = new Date()): string => {
	const seconds = Math.max(
		0,
		Math.floor((now.getTime() - then.getTime()) / 1000),
	);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	if (days > 0) return `${days}d ago`;
	if (hours > 0) return `${hours}h ago`;
	if (minutes > 0) return `${minutes}m ago`;
	return "just now";
};
