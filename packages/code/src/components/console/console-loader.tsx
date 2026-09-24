import { useMemo } from "react";
import { useNavigate } from "react-router";
import type { SessionCatalog } from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";
import { useInsight } from "@semoss/sdk/react";
import { useCatalog, useConsoleSession } from "@/hooks";
import { createTranslate } from "@/utility";
import { Console } from "./console";
import { ConsoleFailure, ConsolePending } from "./console-status";

/** The console, once the room the URL names is open. */
const RoomLoader = ({
	catalog,
	defaultModelId,
	roomId,
}: {
	catalog: SessionCatalog;
	defaultModelId?: string;
	roomId?: string;
}) => {
	const { t, i18n } = useTranslation("code");
	const navigate = useNavigate();
	// The instance changes identity when the language does, and only then.
	const translate = useMemo(() => createTranslate(i18n), [i18n]);
	const room = useConsoleSession({
		catalog,
		defaultModelId,
		roomId,
		translate,
	});

	switch (room.status) {
		case "opening":
			return <ConsolePending label={t("room.opening")} />;
		case "failed":
			return (
				<ConsoleFailure
					title={t("room.openFailed")}
					message={room.message}
					action={t("room.startNew")}
					onAction={() => navigate("/")}
				/>
			);
		case "ready":
			return (
				<Console
					key={room.generation}
					session={room.session}
					openedRoom={room.openedRoom}
					translate={translate}
				/>
			);
	}
};

/**
 * The console, once the harnesses and models to offer, and then the room the
 * URL names, have loaded.
 *
 * @name ConsoleLoader
 * @param props.roomId - The room the URL names, if it names one.
 * @param props.onRetry - Loads everything again, after the models failed to.
 */
export const ConsoleLoader = ({
	roomId,
	onRetry,
}: {
	roomId?: string;
	onRetry: () => void;
}) => {
	const { t } = useTranslation("code");
	const { insightId } = useInsight();
	const catalog = useCatalog(insightId);

	switch (catalog.status) {
		case "loading":
			return <ConsolePending label={t("catalog.loading")} />;
		case "failed":
			return (
				<ConsoleFailure
					title={t("catalog.failed")}
					message={catalog.message}
					action={t("catalog.retry")}
					onAction={onRetry}
				/>
			);
		case "ready":
			return (
				<RoomLoader
					catalog={catalog.catalog}
					defaultModelId={catalog.defaultModelId}
					roomId={roomId}
				/>
			);
	}
};
