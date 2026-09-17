import { observer } from "mobx-react-lite";
import { useCallback, useMemo } from "react";
import {
	getCodeEditorLanguage,
	getFileCodeEditorMenuItems,
	useFileBuffer,
	useFilePanel,
} from "@semoss/panels";
import { useInsight } from "@semoss/sdk/react";
import { FlexLayout } from "@semoss/shared";
import { CodeEditor } from "@semoss/ui/next";
import type { RoomStore } from "@/stores";

interface RoomFileEditorProps {
	/** Node */
	node: FlexLayout.TabNode;

	/** Room */
	room: RoomStore;
}

/**
 * A file open in the room sidebar.
 *
 * Built on the same `useFilePanel`/`useFileBuffer` pair the client's app editor
 * uses, rather than a bespoke editor: those hooks own the read, the save, the
 * permission gates and the unsaved-changes marker, so the tab title's trailing
 * `*` behaves identically here and in the workbench.
 *
 * Remounting on force-refresh is the caller's job — see the key in
 * room-sidebar.tsx. It has to be, because the state to discard lives in the
 * hooks above, which only a remount of this component resets.
 */
export const RoomFileEditor: React.FC<RoomFileEditorProps> = observer(
	({ node, room }) => {
		const insight = useInsight();
		const config: {
			name: string;
			path: string;
		} = node.getConfig();

		// Same tree the explorer lists — the project's when the room has one.
		// See RoomStore.fileMode. FilePanelMode narrows the shared FileMode by
		// requiring insightId on INSIGHT, which fileMode leaves off, so fill it
		// in here from the active insight.
		const mode = useMemo(() => {
			const roomMode = room.fileMode;
			return roomMode.type === "INSIGHT"
				? { type: "INSIGHT" as const, insightId: insight.insightId }
				: roomMode;
		}, [room.fileMode, insight.insightId]);

		const panel = useFilePanel({
			mode,
			name: config.name,
			path: config.path,
		});

		const renameTab = useCallback(
			(name: string) => {
				node.getModel().doAction(
					FlexLayout.Actions.renameTab(node.getId(), name),
				);
			},
			[node],
		);

		const buffer = useFileBuffer({
			panel,
			name: config.name,
			rename: renameTab,
		});

		if (panel.gate) return panel.gate;
		if (panel.readGate) return panel.readGate;

		return (
			<CodeEditor
				className="size-full"
				code={buffer.content}
				disabled={panel.readOnly}
				language={getCodeEditorLanguage(config.path)}
				menuItems={getFileCodeEditorMenuItems({
					canSave: !panel.readOnly,
					isBusy: panel.isBusy,
					onDownload: () => void panel.download(),
					onRefresh: panel.read.refresh,
					onSave: buffer.save,
				})}
				onChange={(value) => buffer.setContent(value ?? "")}
			/>
		);
	},
);
