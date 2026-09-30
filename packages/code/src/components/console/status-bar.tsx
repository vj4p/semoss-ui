import { FolderTreeIcon, MoonIcon, SunIcon } from "lucide-react";
import { useId, useMemo } from "react";
import {
	activeRunEntry,
	type Session,
	type SessionState,
	waitingActions,
} from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";
import {
	Button,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	useTheme,
} from "@semoss/ui/next";
import { useElapsedSeconds } from "@/hooks";

/**
 * What the console is doing, in the words of `status.*`. A call waiting for
 * the user says so ahead of anything else but a stop, wherever it is: a
 * subagent can wait after the run that spawned it has ended.
 */
const runState = (state: SessionState) => {
	const run = activeRunEntry(state);
	if (run?.stopRequested) {
		return "stopping";
	}
	if (waitingActions(state).length > 0 || run?.status === "INPUT_REQUIRED") {
		return "waiting";
	}
	if (run === undefined) {
		return "ready";
	}
	if (run.status === "STARTING" || run.status === "SUBMITTED") {
		return "starting";
	}
	return "running";
};

/**
 * The line under the prompt: the room, the harness and model the next run
 * starts with, the tools that run without asking, and what the console is
 * doing. Those tools stay in sight for as long as they are allowed, and
 * `:revoke` asks about one again.
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
 * @param props.onShowFiles - Called when file explorer button is clicked.
 */
export const StatusBar = ({
	state,
	session,
	openedRoom,
	onShowFiles,
}: {
	state: SessionState;
	session: Session;
	openedRoom?: { roomId: string; name?: string };
	onShowFiles?: () => void;
}) => {
	const { t, i18n } = useTranslation("code");
	const { theme, setTheme } = useTheme();
	const harnessId = useId();
	const modelId = useId();
	const allowedId = useId();
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
			{state.alwaysAllowed.length > 0 && (
				<div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
					<span id={allowedId}>{t("status.alwaysAllowed")}</span>
					<ul
						aria-labelledby={allowedId}
						className="flex min-w-0 flex-wrap gap-1"
						data-testid="statusBar-alwaysAllowed-list"
					>
						{state.alwaysAllowed.map((tool) => (
							<li
								key={tool.toolName}
								className="rounded-sm border px-1 text-foreground"
							>
								<bdi>{tool.label}</bdi>
							</li>
						))}
					</ul>
				</div>
			)}
			{/* Phase 4c placeholders - full implementation pending cost tracking */}
			<p
				className="flex items-baseline gap-1.5 opacity-50"
				title="Session cost (implementation pending)"
			>
				<span>$</span>
				<span className="text-foreground">0.00</span>
			</p>
			<p
				className="flex items-baseline gap-1.5 opacity-50"
				title="Context usage (implementation pending)"
			>
				<span>ctx</span>
				<span className="text-foreground">0%</span>
			</p>
			<p
				className="flex items-baseline gap-1.5 opacity-50"
				title="Git branch (implementation pending)"
			>
				<span>⎇</span>
				<span className="text-foreground">—</span>
			</p>
			<div className="ms-auto flex items-center gap-2">
				{/* File Explorer Button */}
				{onShowFiles && (
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onShowFiles}
						title="Open file explorer"
						data-testid="statusBar-files-button"
					>
						<FolderTreeIcon className="h-4 w-4" />
					</Button>
				)}
				{/* Theme Toggle Button */}
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() =>
						setTheme(theme === "dark" ? "light" : "dark")
					}
					title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
					data-testid="statusBar-theme-button"
				>
					{theme === "dark" ? (
						<SunIcon className="h-4 w-4" />
					) : (
						<MoonIcon className="h-4 w-4" />
					)}
				</Button>
			</div>
			<p className="flex items-baseline gap-2">
				<span className="text-foreground">
					{t(`status.${runState(state)}`)}
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
