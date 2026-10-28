import {
	BotIcon,
	DatabaseIcon,
	HardDriveIcon,
	type LucideIcon,
	PackageIcon,
	SearchIcon,
} from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "@semoss/i18n";
import { H4, Muted, P, Small } from "@semoss/ui/next";
import { getCapabilityPacks } from "@/api/room-data";
import { useOverlayQuery } from "@/hooks/use-overlay-query";
import { OverlayContainer } from "./overlay-container";
import { OverlayEmpty } from "./overlay-empty";
import { OverlayError } from "./overlay-error";
import { OverlayLoading } from "./overlay-loading";

export interface PacksOverlayProps {
	open: boolean;
	onDismiss: () => void;
	/** The room's insight, when there is a room. The packs are not about one room. */
	insightId?: string;
}

/** The icon for an engine kind a pack needs. An unknown kind gets the generic one. */
const ENGINE_ICONS: Readonly<Record<string, LucideIcon>> = {
	DATABASE: DatabaseIcon,
	VECTOR: SearchIcon,
	MODEL: BotIcon,
	STORAGE: HardDriveIcon,
};

/**
 * The `:packs` overlay: the capability packs available on the platform, with
 * how many tools each brings, how many of those ask before they run, and the
 * kinds of engine each needs.
 *
 * @name PacksOverlay
 * @param props.open - Whether the overlay is showing.
 * @param props.onDismiss - Called to close it.
 * @param props.insightId - The room's insight, when there is one.
 */
export const PacksOverlay = ({
	open,
	onDismiss,
	insightId,
}: PacksOverlayProps) => {
	const { t } = useTranslation("code");
	const load = useCallback(() => getCapabilityPacks(insightId), [insightId]);
	const { state, reload } = useOverlayQuery(open, load);

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":packs">
			{state.status === "loading" ? (
				<OverlayLoading />
			) : state.status === "error" ? (
				<OverlayError error={state.error} onRetry={reload} />
			) : state.data.length === 0 ? (
				<OverlayEmpty
					title={t("overlay.packs.empty")}
					description={t("overlay.packs.emptyHint")}
				/>
			) : (
				<div className="flex flex-col gap-4 font-mono">
					<Muted>
						{t("overlay.packs.heading", {
							count: state.data.length,
						})}
					</Muted>
					<ul className="flex flex-col gap-3">
						{state.data.map((pack) => (
							<li
								key={pack.id}
								className="flex flex-col gap-2 rounded-md border p-4"
							>
								<div className="flex items-center gap-2">
									<H4 className="text-base">{pack.label}</H4>
									{(pack.requires ?? []).map(
										(requirement) => {
											const Icon =
												ENGINE_ICONS[requirement] ??
												PackageIcon;
											return (
												<span
													key={requirement}
													className="inline-flex"
												>
													<Icon
														aria-hidden="true"
														className="size-4 text-muted-foreground"
													/>
													<span className="sr-only">
														{requirement}
													</span>
												</span>
											);
										},
									)}
								</div>
								<P className="text-muted-foreground text-sm">
									{pack.description}
								</P>
								<div className="flex gap-4 text-xs">
									<Muted className="text-xs">
										{t("overlay.packs.tools", {
											count: pack.toolCount,
										})}
									</Muted>
									{pack.askCount > 0 ? (
										<Small className="text-warning text-xs">
											{t("overlay.packs.needApproval", {
												count: pack.askCount,
											})}
										</Small>
									) : null}
								</div>
							</li>
						))}
					</ul>
				</div>
			)}
		</OverlayContainer>
	);
};
