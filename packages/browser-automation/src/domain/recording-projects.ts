/** SEMOSS project permission levels: 1 = owner, 2 = edit; higher values can only read. */
const MIN_EDIT_PERMISSION = 1;
const MAX_EDIT_PERMISSION = 2;

/**
 * A recording is written into the app's folder, so only an app the user owns or can edit
 * is a valid target. Global template apps come back from MyProjects with no permission
 * at all, and a missing permission must not read as editable: the server refuses the
 * save for them with a 403. Only the two levels that can edit are accepted; zero,
 * negative, fractional and non-finite values are not levels at all.
 */
export const canEditProject = (permission: unknown): boolean =>
	typeof permission === "number" &&
	Number.isInteger(permission) &&
	permission >= MIN_EDIT_PERMISSION &&
	permission <= MAX_EDIT_PERMISSION;
