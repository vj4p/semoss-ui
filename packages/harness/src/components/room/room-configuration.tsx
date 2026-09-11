import { observer } from "mobx-react-lite";
import { ScrollArea } from "@semoss/ui/next";
import { useChat } from "@/hooks";
import type { RoomStore } from "@/stores";
import { RoomOptionsForm } from "./room-options-form";

interface RoomConfigurationProps {
	/** Room to load */
	room: RoomStore;
}

export const RoomConfiguration: React.FC<RoomConfigurationProps> = observer(
	({ room }) => {
		const { chat } = useChat();

		return (
			<ScrollArea className="h-full w-full">
				<RoomOptionsForm
					model={room.model}
					options={room.options}
					harnessEditable={room.mode === "agent"}
					onModelChange={(model) => {
						if (model) {
							room.setModel(model);
							chat.setSelectedModel(model);
						}
					}}
					onOptionsChange={(options) => {
						if (!options) {
							return;
						}

						room.setOptions(options);

						// harnessType picks which backend loop runs the next
						// message, so it has to survive a reload — the rest of
						// this form stays session-local.
						if (options.harnessType) {
							room.updateRoomOptions(room.options).catch((e) => {
								console.error(
									"Failed to persist agent harness",
									e,
								);
							});
						}
					}}
				/>
			</ScrollArea>
		);
	},
);
