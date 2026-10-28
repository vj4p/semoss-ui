import { isRecord } from "@/utility/is-record";

/** One row of a listing of the room's folder. */
export interface RoomFileEntry {
	name: string;
	path: string;
	isDirectory: boolean;
}

/** The room's own folder, as `BrowseInsightAssets` names it. */
export const ROOM_FOLDER_ROOT = ".";

/**
 * The Pixel that lists one folder of the room's workspace.
 *
 * Run it in the insight the room is bound to: `BrowseInsightAssets` lists that
 * insight's folder, which for a room is the folder its agent works in. It lists
 * one level at a time and refuses a path that leaves the folder, so the overlay
 * lists a folder when it is opened rather than walking the tree up front.
 * `JSON.stringify` quotes the path because file names are not the overlay's own
 * data: one with a double quote in it must not close the string and add Pixel.
 *
 * @name browseRoomFolderPixel
 * @param folder - The folder to list, `ROOM_FOLDER_ROOT` for the top.
 * @return The Pixel expression.
 */
export const browseRoomFolderPixel = (folder: string): string =>
	`BrowseInsightAssets(filePath=[${JSON.stringify(folder)}]);`;

/**
 * The path to list a folder row by. A directory row arrives as `/src/`, and
 * listing it again wants `/src`.
 *
 * @name folderPathOf
 * @param entry - A row of a listing.
 * @return The folder path.
 */
export const folderPathOf = (entry: RoomFileEntry): string =>
	entry.path.replace(/\/+$/, "") || ROOM_FOLDER_ROOT;

/**
 * The rows of a listing, each as the overlay draws it. Rows without a name and
 * a path are dropped, and anything that is not a list reads as empty.
 *
 * @name parseRoomFolderListing
 * @param output - The reactor's output.
 * @return The entries.
 */
export const parseRoomFolderListing = (output: unknown): RoomFileEntry[] => {
	if (!Array.isArray(output)) {
		return [];
	}
	return output.flatMap((row): RoomFileEntry[] => {
		if (!isRecord(row)) {
			return [];
		}
		const { name, path, type } = row;
		if (typeof name !== "string" || typeof path !== "string") {
			return [];
		}
		return [{ name, path, isDirectory: type === "directory" }];
	});
};
