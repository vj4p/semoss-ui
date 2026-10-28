import { cn } from "@semoss/ui/next";
import type { PlaybackController } from "../../hooks/usePlaybackController";
import type {
	RemoteBrowserRecordedStep,
	SelectedTextContext,
} from "../../types/browserEvents";
import { SelectedTextContextsPanel } from "../SelectedTextContextsPanel";
import { LoadedRecordingPanel } from "./LoadedRecordingPanel";
import { RecordedStepsPanel } from "./RecordedStepsPanel";
import { ReplayControlsPanel } from "./ReplayControlsPanel";

interface ReplaySidebarProps {
	playback: PlaybackController;
	recordedStepsOpen: boolean;
	recordedSteps: RemoteBrowserRecordedStep[];
	isRecording: boolean;
	onToggleRecordedSteps: () => void;
	onSaveRecording: () => void;
	selectedTextContextsOpen: boolean;
	selectedTextContexts: SelectedTextContext[];
	onToggleSelectedTextContexts: () => void;
	onCopySelectedContext: (context: SelectedTextContext) => void;
	onDeleteSelectedContext: (contextId: string) => void;
	onSaveSelectedContext: (contextId: string, content: string) => void;
}

/**
 * From `md` up the sidebar is a flex sibling of the viewer, so opening it narrows
 * the viewer (which refits its canvas) instead of covering the page. Below `md`
 * there is no room for both, so it overlays the viewer instead.
 */
export function getReplaySidebarClassName(isOpen: boolean): string {
	return cn(
		"flex shrink-0 flex-col overflow-hidden border-border border-l bg-card transition-[width] duration-150",
		"max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-20 max-md:max-w-full max-md:shadow-xl",
		isOpen ? "w-full max-w-85 md:w-85" : "w-0 border-l-0",
	);
}

export function ReplaySidebar(props: ReplaySidebarProps) {
	const isOpen =
		props.playback.controlsOpen ||
		props.playback.loadedRecordingOpen ||
		props.recordedStepsOpen ||
		props.selectedTextContextsOpen;
	return (
		<aside
			className={getReplaySidebarClassName(isOpen)}
			// a closed panel is zero wide; keep its controls out of the tab order
			inert={!isOpen}
		>
			<div className="min-h-0 overflow-auto">
				<ReplayControlsPanel playback={props.playback} />
				{props.selectedTextContexts.length > 0 && (
					<SelectedTextContextsPanel
						open={props.selectedTextContextsOpen}
						contexts={props.selectedTextContexts}
						onToggle={props.onToggleSelectedTextContexts}
						onCopy={props.onCopySelectedContext}
						onDelete={props.onDeleteSelectedContext}
						onSave={props.onSaveSelectedContext}
					/>
				)}
				<LoadedRecordingPanel playback={props.playback} />
				{props.recordedSteps.length > 0 && (
					<RecordedStepsPanel
						open={props.recordedStepsOpen}
						isRecording={props.isRecording}
						steps={props.recordedSteps}
						onToggle={props.onToggleRecordedSteps}
						onSave={props.onSaveRecording}
					/>
				)}
			</div>
		</aside>
	);
}
