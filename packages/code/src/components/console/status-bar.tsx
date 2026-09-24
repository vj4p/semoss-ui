import { useId, useMemo } from "react";
import {
	activeRunEntry,
	type RunEntry,
	type Session,
	type SessionState,
} from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";
import {
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@semoss/ui/next";
import { useElapsedSeconds } from "@/hooks";

/**
 * What the console is doing, in the words of `status.*`: a run that is
 * waiting for the user says so ahead of anything else it is doing.
 */
const runState = (run: RunEntry | undefined) => {
	if (run === undefined) {
		return "ready";
	}
	if (run.stopRequested) {
		return "stopping";
	}
	if (run.pendingActions.length > 0 || run.status === "INPUT_REQUIRED") {
		return "waiting";
	}
	if (run.status === "STARTING" || run.status === "SUBMITTED") {
		return "starting";
	}
	return "running";
};

/**
 * The line under the prompt: the room, the harness and model the next run
 * starts with, and what the console is doing.
 *
 * The harness and model can be switched here as well as with `:harness` and
 * `:model`, but not while a run is going, which is when the session would
 * refuse the switch. Nothing in it is a live region: the announcer says when
 * a run waits or ends, and a clock read out every second would drown it.
 *
 * @name StatusBar
 * @param props.state - The session's state.
 * @param props.session - The session to switch.
 * @param props.openedRoom - The room the console opened, for its name.
 */
export const StatusBar = ({
	state,
	session,
	openedRoom,
}: {
	state: SessionState;
	session: Session;
	openedRoom?: { roomId: string; name?: string };
}) => {
	const { t, i18n } = useTranslation("code");
	const harnessId = useId();
	const modelId = useId();
	const run = activeRunEntry(state);
	const running = state.activeEntryId !== undefined;
	const elapsed = useElapsedSeconds(run?.startedAt);
	const language = i18n.resolvedLanguage ?? i18n.language;

	const clock = useMemo(() => {
		const minutes = new Intl.NumberFormat(language);
		const seconds = new Intl.NumberFormat(language, {
			minimumIntegerDigits: 2,
		});
		return (total: number) =>
			`${minutes.format(Math.floor(total / 60))}:${seconds.format(total % 60)}`;
	}, [language]);

	const { harnesses, models } = state.catalog;
	const roomLabel =
		state.roomId === undefined
			? t("status.newRoom")
			: (openedRoom?.roomId === state.roomId && openedRoom.name) ||
				state.roomId.slice(0, 8);

	return (
		<div
			className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-2 text-muted-foreground text-xs md:px-6"
			data-testid="statusBar-bar"
		>
			<p className="flex min-w-0 items-baseline gap-1.5">
				<span>{t("status.room")}</span>
				<bdi className="truncate text-foreground">{roomLabel}</bdi>
			</p>
			<div className="flex min-w-0 max-w-full items-center gap-1.5">
				<Label htmlFor={harnessId} className="font-normal text-xs">
					{t("status.harness")}
				</Label>
				<Select
					value={state.harness ?? ""}
					onValueChange={(name) => void session.setHarness(name)}
					disabled={running || harnesses.length === 0}
				>
					<SelectTrigger
						id={harnessId}
						size="sm"
						className="min-w-0 max-w-full text-foreground"
						data-testid="statusBar-harness-select"
					>
						<SelectValue placeholder={t("status.none")} />
					</SelectTrigger>
					<SelectContent>
						{harnesses.map((option) => (
							<SelectItem key={option.name} value={option.name}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="flex min-w-0 max-w-full items-center gap-1.5">
				<Label htmlFor={modelId} className="font-normal text-xs">
					{t("status.model")}
				</Label>
				<Select
					value={state.modelId ?? ""}
					onValueChange={(id) => void session.setModel(id)}
					disabled={running || models.length === 0}
				>
					<SelectTrigger
						id={modelId}
						size="sm"
						className="min-w-0 max-w-full text-foreground"
						data-testid="statusBar-model-select"
					>
						<SelectValue placeholder={t("status.none")} />
					</SelectTrigger>
					<SelectContent>
						{models.map((model) => (
							<SelectItem key={model.id} value={model.id}>
								{model.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<p className="ms-auto flex items-baseline gap-2">
				<span className="text-foreground">
					{t(`status.${runState(run)}`)}
				</span>
				{elapsed !== undefined && (
					<time dateTime={`PT${elapsed}S`} className="tabular-nums">
						{clock(elapsed)}
					</time>
				)}
			</p>
		</div>
	);
};
