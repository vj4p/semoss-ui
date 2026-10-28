import {
	ChevronDownIcon,
	ChevronRightIcon,
	FileIcon,
	FolderIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { runPixel } from "@semoss/sdk";
import { Spinner } from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";
import {
	browseRoomFolderPixel,
	folderPathOf,
	parseRoomFolderListing,
	ROOM_FOLDER_ROOT,
	type RoomFileEntry,
} from "./room-files";

export interface FilesOverlayProps {
	open: boolean;
	onDismiss: () => void;
	/** The insight the room is bound to. Absent until the session has a room. */
	insightId?: string;
}

type Listing =
	| { status: "loading" }
	| { status: "error"; message: string }
	| { status: "ready"; entries: RoomFileEntry[] };

/**
 * The `:files` overlay — the files in the room's workspace.
 *
 * Lists the room's folder, which is where its agent works, one folder at a time
 * as each is opened. A room that does not exist yet has no folder to list.
 */
export const FilesOverlay = ({
	open,
	onDismiss,
	insightId,
}: FilesOverlayProps) => {
	const [listings, setListings] = useState<Record<string, Listing>>({});
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [query, setQuery] = useState("");

	const load = useCallback(
		async (folder: string) => {
			if (!insightId) {
				return;
			}
			setListings((prev) => ({
				...prev,
				[folder]: { status: "loading" },
			}));
			try {
				const response = await runPixel<[unknown]>(
					browseRoomFolderPixel(folder),
					insightId,
				);
				if (response.errors.length > 0) {
					throw new Error(response.errors[0]);
				}
				setListings((prev) => ({
					...prev,
					[folder]: {
						status: "ready",
						entries: parseRoomFolderListing(
							response.pixelReturn[0]?.output,
						),
					},
				}));
			} catch (err) {
				setListings((prev) => ({
					...prev,
					[folder]: {
						status: "error",
						message:
							err instanceof Error
								? err.message
								: "Could not list this folder",
					},
				}));
			}
		},
		[insightId],
	);

	// Each time the overlay opens, start from the room's top folder: files come
	// and go while the agent works, so a listing from last time is stale.
	useEffect(() => {
		if (!open) {
			return;
		}
		setListings({});
		setExpanded(new Set());
		setQuery("");
		void load(ROOM_FOLDER_ROOT);
	}, [open, load]);

	const toggle = (entry: RoomFileEntry) => {
		const folder = folderPathOf(entry);
		const isOpen = expanded.has(folder);
		setExpanded((prev) => {
			const next = new Set(prev);
			if (isOpen) {
				next.delete(folder);
			} else {
				next.add(folder);
			}
			return next;
		});
		if (!isOpen && !listings[folder]) {
			void load(folder);
		}
	};

	const needle = query.trim().toLowerCase();

	const renderFolder = (folder: string, depth: number): ReactNode => {
		const listing = listings[folder];
		if (!listing || listing.status === "loading") {
			return (
				<div
					className="flex items-center gap-2 px-2 py-1"
					style={{ paddingInlineStart: `${depth * 1.5 + 0.5}rem` }}
				>
					<Spinner />
				</div>
			);
		}
		if (listing.status === "error") {
			return (
				<p
					className="px-2 py-1 font-mono text-destructive text-xs"
					style={{ paddingInlineStart: `${depth * 1.5 + 0.5}rem` }}
				>
					{listing.message}
				</p>
			);
		}
		const entries = needle
			? listing.entries.filter(
					(entry) =>
						entry.isDirectory ||
						entry.name.toLowerCase().includes(needle),
				)
			: listing.entries;
		if (entries.length === 0) {
			return (
				<p
					className="px-2 py-1 font-mono text-muted-foreground text-xs"
					style={{ paddingInlineStart: `${depth * 1.5 + 0.5}rem` }}
				>
					{depth === 0 ? "No files yet" : "Empty folder"}
				</p>
			);
		}
		return entries.map((entry) => {
			const entryFolder = folderPathOf(entry);
			const isOpen = expanded.has(entryFolder);
			return (
				<div key={entry.path}>
					<button
						type="button"
						onClick={() =>
							entry.isDirectory
								? toggle(entry)
								: void navigator.clipboard?.writeText(
										entry.path,
									)
						}
						className="flex w-full items-center gap-2 rounded px-2 py-1 text-start font-mono text-sm hover:bg-accent"
						style={{
							paddingInlineStart: `${depth * 1.5 + 0.5}rem`,
						}}
						aria-expanded={entry.isDirectory ? isOpen : undefined}
						title={
							entry.isDirectory
								? "Open or close this folder"
								: "Copy this file's path"
						}
					>
						{entry.isDirectory ? (
							isOpen ? (
								<ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
							) : (
								<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
							)
						) : (
							<span className="size-4 shrink-0" />
						)}
						{entry.isDirectory ? (
							<FolderIcon className="size-4 shrink-0 text-muted-foreground" />
						) : (
							<FileIcon className="size-4 shrink-0 text-muted-foreground" />
						)}
						<span className="flex-1 truncate">{entry.name}</span>
					</button>
					{entry.isDirectory &&
						isOpen &&
						renderFolder(entryFolder, depth + 1)}
				</div>
			);
		});
	};

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":files">
			{!insightId ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono text-muted-foreground text-sm">
						No room yet
					</p>
					<p className="text-muted-foreground text-xs">
						The room's files appear here once you send a message.
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-4">
					<div className="sticky top-0 bg-background pb-2">
						<input
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Filter files in the folders you have opened"
							aria-label="Filter files"
							className="w-full rounded border bg-background px-3 py-2 font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
						/>
					</div>
					<p className="font-mono text-muted-foreground text-xs">
						Open a folder to list it. Select a file to copy its
						path.
					</p>
					<div className="space-y-1 overflow-y-auto">
						{renderFolder(ROOM_FOLDER_ROOT, 0)}
					</div>
				</div>
			)}
		</OverlayContainer>
	);
};
