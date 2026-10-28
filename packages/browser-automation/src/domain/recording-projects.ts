/** SEMOSS project permission levels: 1 = owner, 2 = edit; higher values can only read. */
const MAX_EDIT_PERMISSION = 2;

/**
 * A recording is written into the app's folder, so only an app the user owns or can edit
 * is a valid target. Global template apps come back from MyProjects with no permission
 * at all, and a missing permission must not read as editable: the server refuses the
 * save for them with a 403.
 */
export const canEditProject = (permission: unknown): boolean =>
	typeof permission === "number" && permission <= MAX_EDIT_PERMISSION;
