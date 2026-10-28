import {
	ChevronDownIcon,
	ChevronRightIcon,
	FileIcon,
	FolderIcon,
} from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "@semoss/i18n";
import { Button, Muted } from "@semoss/ui/next";
import { browseRoomFolder } from "@/api/room-data";
import { folderPathOf, type RoomFileEntry } from "@/api/room-files";
import { useOverlayQuery } from "@/hooks/use-overlay-query";
import { OverlayError } from "./overlay-error";
import { OverlayLoading } from "./overlay-loading";

/** The left padding of a row `depth` folders down, which is data, not a design value. */
const indent = (depth: number) => ({
	paddingInlineStart: `${depth * 1.5 + 0.5}rem`,
});

/**
 * One folder of the room's workspace, listed when it is first drawn.
 *
 * Each open folder owns its read, so a failed one has its own Try again, and a
 * read still running when the folder is closed is dropped rather than landing
 * in a folder that is no longer there. Folders the user has opened are drawn
 * inside it, to any depth.
 *
 * @name RoomFolder
 * @param props.insightId - The insight the room is bound to.
 * @param props.folder - The folder to list.
 * @param props.depth - How many folders down this one is, for indentation.
 * @param props.query - Text a file name must contain; folders always show.
 * @param props.expanded - The folders the user has opened.
 * @param props.onToggle - Called with a folder's path to open or close it.
 * @param props.onCopy - Called with a file's path when it is selected.
 */
export const RoomFolder = ({
	insightId,
	folder,
	depth,
	query,
	expanded,
	onToggle,
	onCopy,
}: {
	insightId: string;
	folder: string;
	depth: number;
	query: string;
	expanded: ReadonlySet<string>;
	onToggle: (folder: string) => void;
	onCopy: (path: string) => void;
}) => {
	const { t } = useTranslation("code");
	const load = useCallback(
		() => browseRoomFolder(insightId, folder),
		[insightId, folder],
	);
	const { state, reload } = useOverlayQuery(true, load);

	if (state.status === "loading") {
		return (
			<div style={indent(depth)}>
				<OverlayLoading />
			</div>
		);
	}
	if (state.status === "error") {
		return (
			<div style={indent(depth)}>
				<OverlayError error={state.error} onRetry={reload} />
			</div>
		);
	}

	const needle = query.trim().toLowerCase();
	const entries = needle
		? state.data.filter(
				(entry: RoomFileEntry) =>
					entry.isDirectory ||
					entry.name.toLowerCase().includes(needle),
			)
		: state.data;
	if (entries.length === 0) {
		return (
			<Muted className="block px-2 py-1 font-mono" style={indent(depth)}>
				{needle
					? t("overlay.files.noMatch", { query })
					: depth === 0
						? t("overlay.files.empty")
						: t("overlay.files.emptyFolder")}
			</Muted>
		);
	}

	return (
		<>
			{entries.map((entry: RoomFileEntry) => {
				const entryFolder = folderPathOf(entry);
				const isOpen = expanded.has(entryFolder);
				return (
					<div key={entry.path}>
						<Button
							variant="ghost"
							size="sm"
							className="w-full justify-start font-mono"
							style={indent(depth)}
							aria-expanded={
								entry.isDirectory ? isOpen : undefined
							}
							onClick={() =>
								entry.isDirectory
									? onToggle(entryFolder)
									: onCopy(entry.path)
							}
						>
							{entry.isDirectory ? (
								isOpen ? (
									<ChevronDownIcon aria-hidden="true" />
								) : (
									<ChevronRightIcon aria-hidden="true" />
								)
							) : (
								<span
									className="size-4 shrink-0"
									aria-hidden="true"
								/>
							)}
							{entry.isDirectory ? (
								<FolderIcon aria-hidden="true" />
							) : (
								<FileIcon aria-hidden="true" />
							)}
							<span className="truncate">{entry.name}</span>
						</Button>
						{entry.isDirectory && isOpen ? (
							<RoomFolder
								insightId={insightId}
								folder={entryFolder}
								depth={depth + 1}
								query={query}
								expanded={expanded}
								onToggle={onToggle}
								onCopy={onCopy}
							/>
						) : null}
					</div>
				);
			})}
		</>
	);
};
