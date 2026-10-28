import { OverlayContainer } from "./overlay-container";

export interface DiffOverlayProps {
	open: boolean;
	onDismiss: () => void;
}

/**
 * The `:diff` overlay.
 *
 * It used to run `git status` and `git diff` through a `Bash` Pixel, which does
 * not exist, so it could only ever show an error. There is no replacement to
 * call yet: a diff comes from a project's version history (`ProjectGitStatus`,
 * `ProjectCommitDiff`), and a console room works in its own folder, which has
 * none. Until a room can work inside a project, this says so rather than
 * showing an error that looks like a fault.
 */
export const DiffOverlay = ({ open, onDismiss }: DiffOverlayProps) => (
	<OverlayContainer open={open} onDismiss={onDismiss} title=":diff">
		<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
			<p className="font-mono text-muted-foreground text-sm">
				No changes to compare
			</p>
			<p className="max-w-md text-muted-foreground text-xs">
				A diff needs an app with version history. This room works in its
				own folder, which has none. Use :files to see what the agent
				wrote.
			</p>
		</div>
	</OverlayContainer>
);
