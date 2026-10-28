import { useTranslation } from "@semoss/i18n";
import { OverlayContainer } from "./overlay-container";
import { OverlayEmpty } from "./overlay-empty";

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
 *
 * @name DiffOverlay
 * @param props.open - Whether the overlay is showing.
 * @param props.onDismiss - Called to close it.
 */
export const DiffOverlay = ({ open, onDismiss }: DiffOverlayProps) => {
	const { t } = useTranslation("code");
	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":diff">
			<div className="font-mono">
				<OverlayEmpty
					title={t("overlay.diff.title")}
					description={t("overlay.diff.body")}
				/>
			</div>
		</OverlayContainer>
	);
};
