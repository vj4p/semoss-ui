import { observer } from "mobx-react-lite";
import { preloadNamespaces } from "@semoss/i18n";
import { TerminalConsole, TerminalProvider } from "@semoss/terminal";
import type { RoomStore } from "@/stores";

// TerminalConsole renders with useTranslation("console"), and that namespace is
// registered lazily (see app.tsx) so it isn't fetched at first paint. Pull it
// now, or the console shows raw keys like "run.button". TerminalConsolePanel
// does the same thing for itself; mounting the console directly means doing it
// here. Idempotent.
void preloadNamespaces(["console"]);

interface RoomTerminalProps {
	/** Room whose insight the console runs against. */
	room: RoomStore;
}

/**
 * A Pixel/Python/R/Shell console for the room, in the right side panel.
 *
 * Deliberately mounts `TerminalConsole` rather than `TerminalConsolePanel`.
 * The panel version opens its own insight per tab, which would give the
 * terminal a different working directory from this room's file explorer and
 * editor — both of which are INSIGHT-scoped. TerminalConsole instead reads the
 * ambient insight, and the sidebar already renders inside the room's
 * InsightProvider, so commands here operate on the same files the agent is
 * writing.
 *
 * `consoleId` is keyed to the room so the terminal context can tell consoles
 * apart if more than one room is open.
 */
export const RoomTerminal: React.FC<RoomTerminalProps> = observer(
	({ room }) => (
		<TerminalProvider>
			<TerminalConsole consoleId={`room-${room.roomId}`} />
		</TerminalProvider>
	),
);
