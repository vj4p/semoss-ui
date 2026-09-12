import {
	ExternalLinkIcon,
	FolderIcon,
	LinkIcon,
	PlusIcon,
	SearchIcon,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@semoss/i18n";
import {
	Button,
	cn,
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
	Popover,
	PopoverContent,
	PopoverTrigger,
	Separator,
	Skeleton,
	toast,
} from "@semoss/ui/next";
import { useChat } from "@/hooks";
import type { ProjectKind } from "@/stores";
import type { App } from "@/types";
import { copyToClipboard, platformAppUrl, portalUrl } from "@/utility";

export interface SelectedProject {
	project_id: string;
	project_name?: string;
}

/**
 * Label for a project row.
 *
 * `project_name` is not the name a user recognises: the seeded platform apps
 * all carry project_name "platform" and keep their real name in
 * project_display_name, so listing by project_name renders seven identical
 * "platform" rows. Prefer the display name, then the raw name, then the id.
 */
const projectLabel = (project: {
	project_display_name?: string;
	project_name?: string;
	project_id: string;
}) =>
	project.project_display_name?.trim() ||
	project.project_name?.trim() ||
	project.project_id;

/**
 * Whether the user may write to this project.
 *
 * `user_permission` is the numeric RBAC level, lowest is most privileged:
 * 1 owner, 2 edit, 3 read-only. Absent is treated as not editable — better to
 * skip a scaffold than to write somewhere unexpected.
 */
const isEditable = (project: { user_permission?: number }) =>
	typeof project.user_permission === "number" && project.user_permission <= 2;

interface RoomProjectPickerProps {
	/** Currently scoped project, if any. */
	value?: SelectedProject;

	/** Called with the new selection, or undefined to clear it. */
	onChange: (project: SelectedProject | undefined) => void;

	disabled?: boolean;
}

/**
 * Picks the SEMOSS project (app) a room works on, or creates a new one.
 *
 * This is what keeps a coding session's output inside a real app: with a
 * project selected the agent's working directory becomes that project's assets
 * folder, so its edits land in the project's git-backed VFS and show up in the
 * app catalog. Without one, everything stays in the room folder as scratch.
 */
export const RoomProjectPicker: React.FC<RoomProjectPickerProps> = observer(
	({ value, onChange, disabled = false }) => {
		const { t } = useTranslation(["room", "common"]);
		const { chat } = useChat();

		const [open, setOpen] = useState(false);
		const [projects, setProjects] = useState<App[]>([]);
		const [loading, setLoading] = useState(false);
		const [search, setSearch] = useState("");

		const [createOpen, setCreateOpen] = useState(false);
		const [newName, setNewName] = useState("");
		const [newDescription, setNewDescription] = useState("");
		// Immutable once created — PROJECT_ENUM_TYPE is written into the .smss at
		// creation and no reactor changes it, so this cannot be a later setting.
		const [newKind, setNewKind] = useState<ProjectKind>("CODE");
		const [creating, setCreating] = useState(false);

		const load = useCallback(async () => {
			setLoading(true);
			try {
				setProjects(await chat.listCodeProjects());
			} catch (e) {
				toast.error(
					(e as Error).message || t("room:project.loadFailed"),
				);
			} finally {
				setLoading(false);
			}
		}, [chat, t]);

		useEffect(() => {
			if (open) {
				void load();
			}
		}, [open, load]);

		const filtered = search.trim()
			? projects.filter((p) =>
					projectLabel(p)
						.toLowerCase()
						.includes(search.trim().toLowerCase()),
				)
			: projects;

		const handleCreate = async () => {
			if (!newName.trim() || creating) {
				return;
			}
			setCreating(true);
			try {
				const created = await chat.createCodeProject(
					newName,
					newDescription,
					newKind,
				);
				onChange({
					project_id: created.project_id,
					project_name: projectLabel(created),
				});
				toast.success(
					t("room:project.created", { name: projectLabel(created) }),
				);
				setCreateOpen(false);
				setOpen(false);
				setNewName("");
				setNewDescription("");
			} catch (e) {
				toast.error(
					(e as Error).message || t("room:project.createFailed"),
				);
			} finally {
				setCreating(false);
			}
		};

		return (
			<>
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={disabled}
							className="gap-1.5"
						>
							<FolderIcon />
							<span className="max-w-40 truncate">
								{value?.project_name ??
									value?.project_id ??
									t("room:project.none")}
							</span>
						</Button>
					</PopoverTrigger>

					<PopoverContent align="start" className="w-80 p-0">
						<div className="flex items-center gap-2 border-border border-b px-3 py-2">
							<SearchIcon className="size-4 shrink-0 text-muted-foreground" />
							<input
								className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
								placeholder={t(
									"room:project.searchPlaceholder",
								)}
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>

						<div className="max-h-64 overflow-y-auto p-1">
							{loading ? (
								<div className="space-y-1 p-2">
									<Skeleton className="h-8 w-full" />
									<Skeleton className="h-8 w-full" />
								</div>
							) : null}

							{!loading && filtered.length === 0 ? (
								<div className="p-4 text-center text-muted-foreground text-sm">
									{t("room:project.empty")}
								</div>
							) : null}

							{filtered.map((project) => {
								const isActive =
									project.project_id === value?.project_id;
								return (
									<button
										key={project.project_id}
										type="button"
										className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted/60 ${
											isActive ? "bg-muted/40" : ""
										}`}
										onClick={() => {
											onChange({
												project_id: project.project_id,
												project_name:
													projectLabel(project),
											});
											setOpen(false);
											// Projects created before this
											// existed have no AGENTS.md, so an
											// agent scoped to one still can't
											// tell that portals/ is the served
											// folder. Add it on selection too;
											// it never overwrites an existing
											// one. Not awaited — selecting a
											// project shouldn't wait on it.
											//
											// Only where the user can actually
											// edit: the seeded platform__* apps
											// are in this list read-only, and
											// writing to someone else's project
											// on a mere selection would be
											// rude even though it would fail.
											if (isEditable(project)) {
												void chat.scaffoldProjectForAgents(
													project.project_id,
													projectLabel(project),
													// The guide has to match the
													// project: a blocks app has no
													// portals/ files to explain and
													// a whole JSON contract that a
													// CODE guide says nothing about.
													project.project_type ===
														"BLOCKS"
														? "BLOCKS"
														: "CODE",
												);
											}
										}}
									>
										<FolderIcon className="size-4 shrink-0 text-muted-foreground" />
										<span className="flex-1 truncate">
											{projectLabel(project)}
										</span>
									</button>
								);
							})}
						</div>

						<Separator />

						{/*
						 * The app's own URL, straight from the id. An agent that
						 * just built the app usually cannot produce this — the
						 * backend has no configured public base URL to tell it,
						 * and asking a model for a link it was never given gets
						 * you a container `file://` path. The browser already
						 * knows its origin, so offer the link here instead of
						 * depending on the conversation for it.
						 */}
						{value ? (
							<div className="flex items-center gap-2 p-1">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="flex-1 justify-start"
									onClick={() => {
										const url =
											platformAppUrl(value.project_id) ??
											portalUrl(value.project_id);
										window.open(
											url,
											"_blank",
											"noopener,noreferrer",
										);
									}}
								>
									<ExternalLinkIcon />
									{t("room:project.openApp")}
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => {
										void copyToClipboard(
											platformAppUrl(value.project_id) ??
												portalUrl(value.project_id),
											() =>
												toast.success(
													t(
														"room:project.linkCopied",
													),
												),
											(message) => toast.error(message),
										);
									}}
								>
									<LinkIcon />
								</Button>
							</div>
						) : null}

						<div className="flex items-center gap-2 p-1">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="flex-1 justify-start"
								onClick={() => setCreateOpen(true)}
							>
								<PlusIcon />
								{t("room:project.create")}
							</Button>
							{value ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => {
										onChange(undefined);
										setOpen(false);
									}}
								>
									{t("room:project.clear")}
								</Button>
							) : null}
						</div>
					</PopoverContent>
				</Popover>

				<Dialog open={createOpen} onOpenChange={setCreateOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{t("room:project.createTitle")}
							</DialogTitle>
							<DialogDescription>
								{t("room:project.createDescription")}
							</DialogDescription>
						</DialogHeader>

						<div className="flex flex-col gap-4">
							<Field>
								<FieldLabel>
									{t("room:project.nameLabel")}
								</FieldLabel>
								<Input
									value={newName}
									disabled={creating}
									placeholder="my-app"
									onChange={(e) => setNewName(e.target.value)}
								/>
								<FieldDescription>
									{t("room:project.nameHelp")}
								</FieldDescription>
							</Field>
							<Field>
								<FieldLabel>
									{t("room:project.descriptionLabel")}
								</FieldLabel>
								<Input
									value={newDescription}
									disabled={creating}
									onChange={(e) =>
										setNewDescription(e.target.value)
									}
								/>
							</Field>
							<Field>
								<FieldLabel>
									{t("room:project.kindLabel")}
								</FieldLabel>
								<div className="grid grid-cols-2 gap-2">
									{(
										[
											{
												kind: "CODE" as ProjectKind,
												title: t(
													"room:project.kindCode",
												),
												help: t(
													"room:project.kindCodeHelp",
												),
											},
											{
												kind: "BLOCKS" as ProjectKind,
												title: t(
													"room:project.kindBlocks",
												),
												help: t(
													"room:project.kindBlocksHelp",
												),
											},
										] as const
									).map((option) => (
										<button
											key={option.kind}
											type="button"
											disabled={creating}
											aria-pressed={
												newKind === option.kind
											}
											onClick={() =>
												setNewKind(option.kind)
											}
											className={cn(
												"flex flex-col gap-1 rounded-md border p-3 text-left transition-colors disabled:opacity-50",
												newKind === option.kind
													? "border-primary bg-primary/5"
													: "hover:bg-muted",
											)}
										>
											<span className="font-medium text-sm">
												{option.title}
											</span>
											<span className="text-muted-foreground text-xs">
												{option.help}
											</span>
										</button>
									))}
								</div>
								<FieldDescription>
									{t("room:project.kindHelp")}
								</FieldDescription>
							</Field>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								disabled={creating}
								onClick={() => setCreateOpen(false)}
							>
								{t("common:buttons.cancel")}
							</Button>
							<Button
								type="button"
								disabled={creating || !newName.trim()}
								onClick={() => void handleCreate()}
							>
								{creating
									? t("room:project.creating")
									: t("room:project.create")}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</>
		);
	},
);
