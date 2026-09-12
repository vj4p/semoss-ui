import {
	ClockIcon,
	PauseIcon,
	PlayIcon,
	RefreshCw,
	TrashIcon,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";
import {
	Badge,
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Field,
	FieldDescription,
	FieldLabel,
	Input,
	ScrollArea,
	Skeleton,
	Textarea,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	toast,
} from "@semoss/ui/next";
import type { RoomStore, ScheduledRun } from "@/stores";

/**
 * Common cadences as Quartz expressions.
 *
 * Quartz puts SECONDS first, so these are 6-field and a copied 5-field crontab
 * line will not work — offering presets avoids most of that confusion.
 */
const CRON_PRESETS: { label: string; value: string }[] = [
	{ label: "Every hour", value: "0 0 * * * ?" },
	{ label: "Daily at 03:00", value: "0 0 3 * * ?" },
	{ label: "Weekdays at 09:00", value: "0 0 9 ? * MON-FRI" },
	{ label: "Every Monday at 08:00", value: "0 0 8 ? * MON" },
];

interface RoomScheduledRunsProps {
	room: RoomStore;
}

/**
 * Recurring agent runs for this room.
 *
 * Each job's recipe is a RunAgent call against this room, so a firing appends
 * to this conversation instead of running somewhere invisible. Scheduling needs
 * a project because the scheduler uses the project id as the Quartz job group
 * and permission-checks against it.
 */
export const RoomScheduledRuns: React.FC<RoomScheduledRunsProps> = observer(
	({ room }) => {
		const [runs, setRuns] = useState<ScheduledRun[]>([]);
		const [loading, setLoading] = useState(false);
		const [error, setError] = useState<string | null>(null);

		const [createOpen, setCreateOpen] = useState(false);
		const [name, setName] = useState("");
		const [cron, setCron] = useState(CRON_PRESETS[1].value);
		const [command, setCommand] = useState("");
		const [saving, setSaving] = useState(false);

		const project = room.options.project;

		const load = useCallback(async () => {
			if (!project?.project_id) {
				setRuns([]);
				return;
			}
			setLoading(true);
			setError(null);
			try {
				setRuns(await room.listScheduledRuns());
			} catch (e) {
				setError(
					(e as Error).message || "Failed to load scheduled runs",
				);
			} finally {
				setLoading(false);
			}
		}, [room, project?.project_id]);

		useEffect(() => {
			void load();
		}, [load]);

		const act = async (
			jobId: string,
			action: "pause" | "resume" | "run" | "delete",
		) => {
			try {
				await room.updateScheduledRun(jobId, action);
				toast.success(
					action === "run"
						? "Triggered now"
						: action === "delete"
							? "Schedule removed"
							: action === "pause"
								? "Paused"
								: "Resumed",
				);
				await load();
			} catch (e) {
				toast.error((e as Error).message || `Failed to ${action}`);
			}
		};

		const handleCreate = async () => {
			if (!name.trim() || !cron.trim() || !command.trim() || saving) {
				return;
			}
			setSaving(true);
			try {
				await room.scheduleRun({
					jobName: name.trim(),
					cronExpression: cron.trim(),
					command: command.trim(),
				});
				toast.success(`Scheduled "${name.trim()}"`);
				setCreateOpen(false);
				setName("");
				setCommand("");
				await load();
			} catch (e) {
				toast.error(
					(e as Error).message || "Failed to schedule the run",
				);
			} finally {
				setSaving(false);
			}
		};

		return (
			<div className="flex h-full flex-col">
				<div className="flex items-center gap-2 border-border border-b px-3 py-2">
					<span className="font-semibold text-sm">
						Scheduled runs
					</span>
					{runs.length > 0 ? (
						<Badge variant="secondary">{runs.length}</Badge>
					) : null}
					<div className="ml-auto flex items-center gap-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									size="sm"
									variant="ghost"
									disabled={loading}
									onClick={() => void load()}
								>
									<RefreshCw className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Refresh</TooltipContent>
						</Tooltip>
						<Button
							size="sm"
							variant="outline"
							disabled={!project?.project_id}
							onClick={() => setCreateOpen(true)}
						>
							New schedule
						</Button>
					</div>
				</div>

				<ScrollArea className="flex-1">
					<div className="space-y-2 p-3">
						{!project?.project_id ? (
							<div className="rounded-md border border-border border-dashed p-6 text-center text-muted-foreground text-sm">
								Select a project for this room first. The
								scheduler groups jobs by project and checks
								permission against it, so a room without one
								cannot schedule.
							</div>
						) : null}

						{loading && runs.length === 0 ? (
							<Skeleton className="h-16 w-full" />
						) : null}

						{error ? (
							<div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm">
								{error}
							</div>
						) : null}

						{project?.project_id &&
						!loading &&
						!error &&
						runs.length === 0 ? (
							<div className="rounded-md border border-border border-dashed p-6 text-center text-muted-foreground text-sm">
								No scheduled runs. Add one to re-run a task on a
								cadence without being here for it.
							</div>
						) : null}

						{runs.map((job) => (
							<div
								key={job.jobId}
								className="rounded-md border border-border bg-card p-3"
							>
								<div className="flex items-center gap-2">
									<ClockIcon className="size-4 shrink-0 text-muted-foreground" />
									<span className="min-w-0 flex-1 truncate font-medium text-sm">
										{job.jobName}
									</span>
									{job.paused ? (
										<Badge variant="secondary">
											Paused
										</Badge>
									) : null}
									{job.executing ? (
										<Badge variant="secondary">
											Running
										</Badge>
									) : null}
								</div>

								<div className="mt-1 font-mono text-muted-foreground text-xs">
									{job.cronExpression}
								</div>
								<div className="mt-1 text-muted-foreground text-xs">
									{[
										job.nextFireTime
											? `Next: ${job.nextFireTime}`
											: null,
										job.previousFireTime
											? `Last: ${job.previousFireTime}`
											: null,
									]
										.filter(Boolean)
										.join(" · ")}
								</div>

								<div className="mt-2 flex items-center gap-1">
									<Button
										size="sm"
										variant="ghost"
										onClick={() =>
											void act(job.jobId, "run")
										}
									>
										Run now
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() =>
											void act(
												job.jobId,
												job.paused ? "resume" : "pause",
											)
										}
									>
										{job.paused ? (
											<PlayIcon />
										) : (
											<PauseIcon />
										)}
										{job.paused ? "Resume" : "Pause"}
									</Button>
									<Button
										size="sm"
										variant="ghost"
										className="ml-auto text-destructive"
										onClick={() =>
											void act(job.jobId, "delete")
										}
									>
										<TrashIcon />
									</Button>
								</div>
							</div>
						))}
					</div>
				</ScrollArea>

				<Dialog open={createOpen} onOpenChange={setCreateOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>New scheduled run</DialogTitle>
							<DialogDescription>
								Re-runs this room's agent on a cadence. Each
								firing appends to this conversation and runs as
								you.
							</DialogDescription>
						</DialogHeader>

						<div className="flex flex-col gap-4">
							<Field>
								<FieldLabel>Name</FieldLabel>
								<Input
									value={name}
									disabled={saving}
									placeholder="nightly-check"
									onChange={(e) => setName(e.target.value)}
								/>
							</Field>

							<Field>
								<FieldLabel>Prompt to run</FieldLabel>
								<Textarea
									className="h-20 resize-none"
									value={command}
									disabled={saving}
									placeholder="Check for failing tests and summarize what broke."
									onChange={(e) => setCommand(e.target.value)}
								/>
							</Field>

							<Field>
								<FieldLabel>Cadence</FieldLabel>
								<div className="mb-2 flex flex-wrap gap-1">
									{CRON_PRESETS.map((preset) => (
										<Button
											key={preset.value}
											type="button"
											size="sm"
											variant={
												cron === preset.value
													? "default"
													: "outline"
											}
											disabled={saving}
											onClick={() =>
												setCron(preset.value)
											}
										>
											{preset.label}
										</Button>
									))}
								</div>
								<Input
									className="font-mono text-xs"
									value={cron}
									disabled={saving}
									onChange={(e) => setCron(e.target.value)}
								/>
								<FieldDescription>
									Quartz cron — seconds come first, so this
									has six fields. A five-field crontab line
									will be rejected.
								</FieldDescription>
							</Field>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								disabled={saving}
								onClick={() => setCreateOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="button"
								disabled={
									saving ||
									!name.trim() ||
									!cron.trim() ||
									!command.trim()
								}
								onClick={() => void handleCreate()}
							>
								{saving ? "Scheduling..." : "Schedule"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		);
	},
);
