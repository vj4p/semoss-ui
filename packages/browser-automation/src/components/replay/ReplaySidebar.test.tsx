// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaybackController } from "../../hooks/usePlaybackController";
import { getReplaySidebarClassName, ReplaySidebar } from "./ReplaySidebar";

// The panels have their own concerns; the sidebar is only the frame around them.
vi.mock("./ReplayControlsPanel", () => ({
	ReplayControlsPanel: () => (
		<button type="button">Replay panel control</button>
	),
}));
vi.mock("./LoadedRecordingPanel", () => ({ LoadedRecordingPanel: () => null }));
vi.mock("./RecordedStepsPanel", () => ({ RecordedStepsPanel: () => null }));
vi.mock("../SelectedTextContextsPanel", () => ({
	SelectedTextContextsPanel: () => null,
}));

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function renderSidebar(controlsOpen: boolean) {
	const playback = {
		controlsOpen,
		loadedRecordingOpen: false,
	} as unknown as PlaybackController;
	act(() => {
		root.render(
			<ReplaySidebar
				playback={playback}
				recordedStepsOpen={false}
				recordedSteps={[]}
				isRecording={false}
				onToggleRecordedSteps={() => undefined}
				onSaveRecording={() => undefined}
				selectedTextContextsOpen={false}
				selectedTextContexts={[]}
				onToggleSelectedTextContexts={() => undefined}
				onCopySelectedContext={() => undefined}
				onDeleteSelectedContext={() => undefined}
				onSaveSelectedContext={() => undefined}
			/>,
		);
	});
	const aside = container.querySelector("aside");
	if (!aside) throw new Error("sidebar not rendered");
	return aside;
}

describe("ReplaySidebar layout", () => {
	it("takes its own width beside the viewer from md up, and overlays it below", () => {
		const open = getReplaySidebarClassName(true).split(" ");
		// a flex sibling, so the viewer's ResizeObserver refits the canvas
		expect(open).toContain("shrink-0");
		expect(open).toContain("md:w-85");
		expect(open).not.toContain("absolute");
		expect(open).not.toContain("md:absolute");
		// below md it overlays, and never wider than the screen
		expect(open).toContain("max-md:absolute");
		expect(open).toContain("max-md:max-w-full");
		expect(open.join(" ")).not.toMatch(/z-\[/);
	});

	it("collapses to nothing when closed", () => {
		const closed = getReplaySidebarClassName(false).split(" ");
		expect(closed).toContain("w-0");
		expect(closed).toContain("border-l-0");
		expect(closed).not.toContain("md:w-85");
	});

	it("keeps a closed sidebar's controls out of the tab order and the accessibility tree", () => {
		expect(renderSidebar(false).hasAttribute("inert")).toBe(true);
	});

	it("makes an open sidebar's controls reachable", () => {
		const aside = renderSidebar(true);
		expect(aside.hasAttribute("inert")).toBe(false);
		expect(aside.textContent).toContain("Replay panel control");
	});
});
