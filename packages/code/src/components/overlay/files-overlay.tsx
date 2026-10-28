import { useState } from "react";
import { useTranslation } from "@semoss/i18n";
import { Button, Input, Muted } from "@semoss/ui/next";
import { ROOM_FOLDER_ROOT } from "@/api/room-files";
import { OverlayContainer } from "./overlay-container";
import { OverlayEmpty } from "./overlay-empty";
import { RoomFolder } from "./room-folder";

export interface FilesOverlayProps {
	open: boolean;
	onDismiss: () => void;
	/** The insight the room is bound to. Absent until the session has a room. */
	insightId?: string;
}

/**
 * The `:files` overlay: the files in the room's workspace.
 *
 * Lists the room's folder, which is where its agent works, one folder at a
 * time as each is opened. A room that does not exist yet has no folder to
 * list. Selecting a file copies its path, and says whether that worked.
 *
 * @name FilesOverlay
 * @param props.open - Whether the overlay is showing.
 * @param props.onDismiss - Called to close it.
 * @param props.insightId - The room's insight, when there is a room.
 */
export const FilesOverlay = ({
	open,
	onDismiss,
	insightId,
}: FilesOverlayProps) => {
	const { t } = useTranslation("code");
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
	const [query, setQuery] = useState("");
	const [copyResult, setCopyResult] = useState<string>("");

	const toggle = (folder: string) =>
		setExpanded((previous) => {
			const next = new Set(previous);
			if (!next.delete(folder)) {
				next.add(folder);
			}
			return next;
		});

	const copy = (path: string) => {
		const clipboard = navigator.clipboard;
		if (!clipboard) {
			setCopyResult(t("overlay.files.copyFailed", { path }));
			return;
		}
		clipboard.writeText(path).then(
			() => setCopyResult(t("overlay.files.copied", { path })),
			() => setCopyResult(t("overlay.files.copyFailed", { path })),
		);
	};

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":files">
			{insightId === undefined ? (
				<OverlayEmpty
					title={t("overlay.files.noRoomTitle")}
					description={t("overlay.files.noRoomBody")}
				/>
			) : (
				<div className="flex flex-col gap-4 font-mono">
					<div className="flex items-center gap-2">
						<Input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t("overlay.files.filterPlaceholder")}
							aria-label={t("overlay.files.filterLabel")}
						/>
						{query ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setQuery("")}
							>
								{t("overlay.files.clearFilter")}
							</Button>
						) : null}
					</div>
					<Muted>{t("overlay.files.hint")}</Muted>
					<div className="flex flex-col gap-1 overflow-y-auto">
						<RoomFolder
							insightId={insightId}
							folder={ROOM_FOLDER_ROOT}
							depth={0}
							query={query}
							expanded={expanded}
							onToggle={toggle}
							onCopy={copy}
						/>
					</div>
					<output className="text-muted-foreground text-sm">
						{copyResult}
					</output>
				</div>
			)}
		</OverlayContainer>
	);
};
