import { PlusIcon, TrashIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "@semoss/i18n";
import {
	Badge,
	Button,
	Field,
	FieldDescription,
	FieldLabel,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Textarea,
	ToggleGroup,
	ToggleGroupItem,
} from "@semoss/ui/next";
import type { AgentHook, AgentHookEvent, AgentHookKind } from "@/types";

/**
 * A hook plus a client-only id. Hook entries have no identity of their own and
 * the backend persists them as-is, so the id must never reach the wire — React
 * needs it to keep each row's inputs attached to the right entry when one is
 * removed, and an index key would hand row N's text to row N-1.
 */
export type AgentHookRow = AgentHook & { _uid: string };

let uidCounter = 0;
const nextUid = () => `hook-${++uidCounter}`;

/** Wrap persisted hooks for editing. */
export const toHookRows = (hooks: AgentHook[]): AgentHookRow[] =>
	hooks.map((hook) => ({ ...hook, _uid: nextUid() }));

/** Strip client-only ids before persisting. */
export const fromHookRows = (rows: AgentHookRow[]): AgentHook[] =>
	rows.map(({ _uid: _drop, ...hook }) => hook);

/**
 * Hook kinds AgentHookRegistry registers. Anything else is rejected by
 * validateHooks on save, so this list is the source of truth for the UI.
 */
const HOOK_KINDS: AgentHookKind[] = [
	"pixel",
	"git_commit",
	"log_tools",
	"ppt_to_pdf",
];

/**
 * Lifecycle events PixelReactorHook accepts. Only `pixel` hooks take an event
 * filter — the other kinds bind to their own fixed points.
 */
const HOOK_EVENTS: AgentHookEvent[] = [
	"onRoomCreation",
	"beforeRun",
	"afterAgentInit",
	"beforeTool",
	"afterTool",
	"afterRun",
	"beforeAgentDeInit",
];

/** Events that actually carry a tool name, so the tool filter applies. */
const TOOL_EVENTS: AgentHookEvent[] = ["beforeTool", "afterTool"];

/**
 * True when the rule runs at a tool event. An empty selection means "every
 * event", which includes the tool ones.
 */
const toolEventSelected = (events?: AgentHookEvent[]) =>
	!events?.length || events.some((event) => TOOL_EVENTS.includes(event));

/** Split the comma-separated input into trimmed, de-duplicated tool names. */
const parseToolList = (value: string): string[] => [
	...new Set(
		value
			.split(",")
			.map((entry) => entry.trim())
			.filter(Boolean),
	),
];

interface WorkspaceHooksFormProps {
	/** Current hook entries. */
	hooks: AgentHookRow[];

	/** Called with the full replacement list on every edit. */
	onChange: (hooks: AgentHookRow[]) => void;

	/** Render read-only (e.g. the caller lacks edit permission). */
	disabled?: boolean;
}

/**
 * Editor for `WORKSPACE.CONFIG_JSON.hooks[]` — rules that run at agent
 * lifecycle points. `pixel` hooks fire an arbitrary Pixel expression, so this
 * is how a user adds a verify/commit/log step to an agent without writing Java.
 */
export const WorkspaceHooksForm: React.FC<WorkspaceHooksFormProps> = observer(
	({ hooks, onChange, disabled = false }) => {
		const { t } = useTranslation(["workspace", "common"]);

		const update = (index: number, patch: Partial<AgentHook>) => {
			onChange(
				hooks.map((hook, i) =>
					i === index ? { ...hook, ...patch } : hook,
				),
			);
		};

		const addHook = () => {
			onChange([
				...hooks,
				{ kind: "pixel", pixel: "", events: [], _uid: nextUid() },
			]);
		};

		const removeHook = (index: number) => {
			onChange(hooks.filter((_, i) => i !== index));
		};

		return (
			<div className="flex flex-col gap-3">
				{hooks.length === 0 ? (
					<div className="rounded-md border border-border border-dashed p-6 text-center text-muted-foreground text-sm">
						{t("workspace:hooks.empty")}
					</div>
				) : null}

				{hooks.map((hook, index) => {
					const isPixel = hook.kind === "pixel";
					// An empty pixel is the one thing the backend rejects, so
					// surface it here rather than on save.
					const pixelMissing = isPixel && !hook.pixel?.trim();

					return (
						<div
							key={hook._uid}
							className="rounded-md border border-border bg-card p-3"
						>
							<div className="flex items-center gap-2">
								<Select
									value={hook.kind}
									disabled={disabled}
									onValueChange={(value) =>
										update(index, {
											kind: value as AgentHookKind,
											// Drop pixel-only fields when
											// switching to a fixed kind.
											...(value === "pixel"
												? {}
												: {
														pixel: undefined,
														events: undefined,
														tools: undefined,
													}),
										})
									}
								>
									<SelectTrigger className="w-48">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{HOOK_KINDS.map((kind) => (
											<SelectItem key={kind} value={kind}>
												{t(
													`workspace:hooks.kinds.${kind}.label`,
												)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								{!isPixel && (
									<Badge variant="secondary">
										{t("workspace:hooks.fixedPoint")}
									</Badge>
								)}

								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="ml-auto"
									disabled={disabled}
									aria-label={t("workspace:hooks.remove")}
									onClick={() => removeHook(index)}
								>
									<TrashIcon />
								</Button>
							</div>

							<FieldDescription className="mt-2">
								{t(
									`workspace:hooks.kinds.${hook.kind}.description`,
								)}
							</FieldDescription>

							{isPixel ? (
								<div className="mt-3 flex flex-col gap-3">
									<Field>
										<FieldLabel>
											{t("workspace:hooks.pixelLabel")}
										</FieldLabel>
										<Textarea
											className="h-20 resize-none font-mono text-xs"
											placeholder="ValidateApp(project=[&quot;my-project&quot;]);"
											value={hook.pixel ?? ""}
											disabled={disabled}
											aria-invalid={pixelMissing}
											onChange={(e) =>
												update(index, {
													pixel: e.target.value,
												})
											}
										/>
										<FieldDescription
											className={
												pixelMissing
													? "text-destructive"
													: undefined
											}
										>
											{pixelMissing
												? t(
														"workspace:hooks.pixelRequired",
													)
												: t(
														"workspace:hooks.pixelHelp",
													)}
										</FieldDescription>
									</Field>

									<Field>
										<FieldLabel>
											{t("workspace:hooks.eventsLabel")}
										</FieldLabel>
										<ToggleGroup
											type="multiple"
											variant="outline"
											size="sm"
											className="flex-wrap justify-start"
											disabled={disabled}
											value={hook.events ?? []}
											onValueChange={(value: string[]) =>
												update(index, {
													events: value as AgentHookEvent[],
												})
											}
										>
											{HOOK_EVENTS.map((event) => (
												<ToggleGroupItem
													key={event}
													value={event}
													className="font-mono text-xs"
												>
													{event}
												</ToggleGroupItem>
											))}
										</ToggleGroup>
										<FieldDescription>
											{(hook.events?.length ?? 0) === 0
												? t("workspace:hooks.eventsAll")
												: t(
														"workspace:hooks.eventsHelp",
													)}
										</FieldDescription>
									</Field>

									{/*
									 * Only the tool events carry a tool, so the
									 * filter is meaningless for a rule that runs
									 * purely at run level.
									 */}
									{toolEventSelected(hook.events) ? (
										<Field>
											<FieldLabel>
												{t(
													"workspace:hooks.toolsLabel",
												)}
											</FieldLabel>
											<Input
												className="font-mono text-xs"
												placeholder="WriteFile, EditFile"
												value={(hook.tools ?? []).join(
													", ",
												)}
												disabled={disabled}
												onChange={(e) =>
													update(index, {
														tools: parseToolList(
															e.target.value,
														),
													})
												}
											/>
											<FieldDescription>
												{(hook.tools?.length ?? 0) === 0
													? t(
															"workspace:hooks.toolsAll",
														)
													: t(
															"workspace:hooks.toolsHelp",
														)}
											</FieldDescription>
										</Field>
									) : null}
								</div>
							) : null}
						</div>
					);
				})}

				<div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled}
						onClick={addHook}
					>
						<PlusIcon />
						{t("workspace:hooks.add")}
					</Button>
				</div>
			</div>
		);
	},
);
