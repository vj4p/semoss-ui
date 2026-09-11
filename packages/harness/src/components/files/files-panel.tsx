import { useState } from "react";
import type { FileItem } from "@semoss/shared";
import {
	FileEditor,
	FileExplorer,
	FileExplorerHeader,
	FileExplorerRefreshAction,
	useFileExplorer,
} from "@semoss/shared";

interface FilesPanelProps {
	projectId: string;
}

export const FilesPanel = ({ projectId }: FilesPanelProps) => {
	const [openPath, setOpenPath] = useState<string | null>(null);

	const explorer = useFileExplorer({
		mode: { type: "APP", app: projectId },
		onItemSelect: (item: FileItem) => setOpenPath(item.path),
		onItemsMoved: (movedItems) => {
			setOpenPath((current) => {
				if (current === null) return current;
				const moved = movedItems.find((m) => m.oldPath === current);
				return moved ? moved.newPath : current;
			});
		},
		onItemsDeleted: (deletedItems) => {
			setOpenPath((current) => {
				if (current === null) return current;
				return deletedItems.some((item) => item.path === current)
					? null
					: current;
			});
		},
	});

	return (
		<div className="flex h-full">
			<div className="w-64 shrink-0 overflow-auto border-r">
				<FileExplorer
					explorer={explorer}
					header={
						<FileExplorerHeader
							explorer={explorer}
							actions={
								<FileExplorerRefreshAction
									explorer={explorer}
								/>
							}
						/>
					}
					newFileOverlay={null}
				/>
			</div>
			<div className="flex-1 overflow-hidden">
				{openPath ? (
					<FileEditor
						mode={{ type: "APP", app: projectId }}
						path={openPath}
					/>
				) : (
					<div className="flex h-full items-center justify-center text-muted-foreground">
						Select a file to view or edit it.
					</div>
				)}
			</div>
		</div>
	);
};
