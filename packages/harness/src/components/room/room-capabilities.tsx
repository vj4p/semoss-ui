import {
	AlertTriangleIcon,
	Loader2Icon,
	RefreshCwIcon,
	XIcon,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@semoss/i18n";
import { useInsight } from "@semoss/sdk/react";
import { EngineSelect } from "@semoss/shared";
import {
	Badge,
	Button,
	Label,
	ScrollArea,
	Switch,
	toast,
} from "@semoss/ui/next";
import { useRoomPacks } from "@/hooks";
import type { RoomStore } from "@/stores";
import type { Engine, ProjectDependency } from "@/types";
import type { CapabilityPack } from "@/utility";

interface RoomCapabilitiesProps {
	/** Room whose project and tool set are being configured. */
	room: RoomStore;
}

/** Engine categories a pack can depend on, in display order. */
const ENGINE_KINDS = [
	{ type: "DATABASE", labelKey: "capabilities.databases" },
	{ type: "VECTOR", labelKey: "capabilities.knowledgeStores" },
	{ type: "STORAGE", labelKey: "capabilities.storage" },
	// A FUNCTION engine *is* a tool — web search, send-mail, OCR, arbitrary REST —
	// so attaching one both names it in the prompt and generates its tool below.
	{ type: "FUNCTION", labelKey: "capabilities.functions" },
] as const;

/**
 * `SetProjectDependencies` replaces the whole list and expects `{id, type}`
 * entries. Project-kind dependencies — how an MCP toolbox is attached — are
 * always typed `PROJECT` on the wire regardless of what the read side reported.
 *
 * @param dependency - the dependency to serialize.
 */
const toDependencyPayload = (dependency: ProjectDependency) => ({
	id: dependency.engine_id,
	type:
		dependency.engine_type === "PROJECT"
			? "PROJECT"
			: dependency.engine_type,
});

/**
 * What the agent can reach beyond its own files: which engines this project is
 * attached to, and which reactor bundles are exposed to it as tools.
 *
 * The two share a panel because neither is much use alone. Attaching an engine is
 * what fills the `# Selected Engines` block the backend already injects into every
 * project-scoped run — leave it empty and the model is told it has pre-selected
 * engines, shown nothing, and instructed never to use an unlisted one, which
 * resolves to "ask the user" on every turn. And a pack of query tools has nothing
 * to query until an engine is attached.
 *
 * The scopes differ, deliberately. Engine attachment is a project dependency, so
 * it is shared by everyone working on that project and outlives the room. Packs are
 * per-room: enabling one attaches a seeded `platform__pack-*` project as an MCP
 * toolbox — see {@link RoomStore.setCapabilityPack}.
 *
 * The pack list is read from the platform, not held here. `MyProjects` filtered to
 * the `MCP` tag doubles as the access check, and each pack's tool count and approval
 * modes come from its own generated toolbox, so an operator can add or re-curate a
 * pack without a frontend build. This panel exists alongside the generic MCP picker
 * because it can say the things that matter before you switch a capability on — how
 * many tools, how many stop to ask, and whether there is an engine attached for them
 * to point at.
 */
export const RoomCapabilities: React.FC<RoomCapabilitiesProps> = observer(
	({ room }) => {
		const { t } = useTranslation("room");
		const insight = useInsight();

		const projectId = room.options.project?.project_id;

		const [dependencies, setDependencies] = useState<ProjectDependency[]>(
			[],
		);
		const [isLoading, setIsLoading] = useState(false);
		const [savingEngine, setSavingEngine] = useState(false);
		const [pendingPack, setPendingPack] = useState<string | null>(null);
		// Shared with the composer's reach strip, so the platform is read for packs
		// in exactly one place.
		const {
			packs,
			loading: packsLoading,
			reload: reloadPacks,
		} = useRoomPacks();

		const loadDependencies = useCallback(async () => {
			if (!projectId) {
				setDependencies([]);
				return;
			}
			setIsLoading(true);
			try {
				const { pixelReturn } = await insight.actions.run<
					[ProjectDependency[]]
				>(
					`GetProjectDependencies(project=[${JSON.stringify(projectId)}]);`,
				);
				const output = pixelReturn[0]?.output;
				setDependencies(Array.isArray(output) ? output : []);
			} catch (e) {
				console.error("Failed to load project dependencies", e);
				setDependencies([]);
			} finally {
				setIsLoading(false);
			}
		}, [projectId, insight.actions]);

		useEffect(() => {
			void loadDependencies();
		}, [loadDependencies]);

		/**
		 * Persist a new dependency list.
		 *
		 * The whole list goes every time, so every other category — and every
		 * project-kind dependency — has to be carried through, or attaching a
		 * database would silently detach an MCP toolbox.
		 *
		 * @param next - the complete list to save.
		 */
		const saveDependencies = async (next: ProjectDependency[]) => {
			if (!projectId) return;
			setSavingEngine(true);
			try {
				await insight.actions.run(
					`SetProjectDependencies(project=${JSON.stringify(projectId)}, dependencies=${JSON.stringify(
						next.map(toDependencyPayload),
					)})`,
				);
				setDependencies(next);
			} catch (e) {
				toast.error(
					(e as Error).message || t("capabilities.engineSaveFailed"),
				);
				// Re-read rather than trust local state after a failed write.
				await loadDependencies();
			} finally {
				setSavingEngine(false);
			}
		};

		/**
		 * Generate the room tool for a newly attached FUNCTION engine.
		 *
		 * Attaching an engine as a dependency only *names* it in the Selected Engines
		 * prompt. For a database or a vector store that is the right amount — the
		 * query tools come from a pack. But a function engine is itself a single
		 * callable thing, so naming it without exposing it leaves the model able to see
		 * a search engine it cannot call.
		 *
		 * `MakeDefaultRoomToolsForEngine` is the platform's own generator for this: it
		 * rewrites the generic `ExecuteFunctionEngine` tool to present that function's
		 * declared parameters and pins the engine id so the model cannot retarget it.
		 * It stamps a different generator than the capability packs do, so the two sets
		 * of tools coexist in the room's toolbox rather than overwriting each other.
		 */
		const generateFunctionTool = async (engine: Engine) => {
			try {
				await insight.actions.run(
					`MakeDefaultRoomToolsForEngine(engine=[${JSON.stringify(
						engine.engine_id,
					)}]);`,
				);
			} catch (e) {
				// The dependency is saved either way; the tool can be regenerated.
				console.error(
					"Could not generate the function engine's tool",
					e,
				);
			}
		};

		const attach = (engine: Engine) => {
			if (dependencies.some((d) => d.engine_id === engine.engine_id)) {
				return;
			}
			if (engine.engine_type === "FUNCTION") {
				void generateFunctionTool(engine);
			}
			void saveDependencies([
				...dependencies,
				{
					engine_id: engine.engine_id,
					engine_name: engine.engine_name,
					engine_type:
						engine.engine_type as ProjectDependency["engine_type"],
				},
			]);
		};

		const detach = (engineId: string) => {
			void saveDependencies(
				dependencies.filter((d) => d.engine_id !== engineId),
			);
		};

		const togglePack = async (pack: CapabilityPack, enabled: boolean) => {
			setPendingPack(pack.id);
			try {
				await room.setCapabilityPack(pack.id, enabled);
				toast.success(
					enabled
						? t("capabilities.packEnabled", { name: pack.label })
						: t("capabilities.packDisabled", { name: pack.label }),
				);
			} catch (e) {
				toast.error(
					(e as Error).message || t("capabilities.packFailed"),
				);
			} finally {
				setPendingPack(null);
			}
		};

		/** Attached engine types, for the "needs an engine" hint on a pack. */
		const attachedTypes = new Set(dependencies.map((d) => d.engine_type));

		return (
			<ScrollArea className="h-full">
				<div className="flex flex-col gap-6 p-4">
					{/*
					 * Only the engines half needs a project — attachment is a project
					 * dependency. Packs are per-room and several (Browser, Frames) have
					 * nothing to do with a project at all, so gating the whole panel on
					 * one made them unreachable in a scratch room.
					 */}
					<section className="flex flex-col gap-3">
						<div>
							<h3 className="font-medium text-sm">
								{t("capabilities.enginesTitle")}
							</h3>
							<p className="text-muted-foreground text-xs">
								{projectId
									? t("capabilities.enginesHelp")
									: t("capabilities.noProject")}
							</p>
						</div>

						{!projectId ? null : isLoading ? (
							<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
						) : (
							<div className="flex flex-col gap-4">
								{ENGINE_KINDS.map((kind) => {
									const attached = dependencies.filter(
										(d) => d.engine_type === kind.type,
									);
									return (
										<div
											key={kind.type}
											className="flex flex-col gap-2"
										>
											<Label className="text-muted-foreground text-xs">
												{t(kind.labelKey)}
											</Label>
											{attached.length > 0 && (
												<div className="flex flex-wrap gap-1">
													{attached.map((d) => (
														<Badge
															key={d.engine_id}
															variant="secondary"
															className="gap-1 pr-1"
														>
															{d.engine_name ??
																d.engine_id}
															<Button
																variant="ghost"
																size="icon"
																className="size-4"
																disabled={
																	savingEngine
																}
																aria-label={t(
																	"capabilities.detach",
																)}
																onClick={() =>
																	detach(
																		d.engine_id,
																	)
																}
															>
																<XIcon className="size-3" />
															</Button>
														</Badge>
													))}
												</div>
											)}
											<EngineSelect
												name=""
												value=""
												engineTypes={[kind.type]}
												disabled={savingEngine}
												onChange={attach}
											/>
										</div>
									);
								})}
							</div>
						)}
					</section>

					<section className="flex flex-col gap-3">
						<div className="flex items-start justify-between gap-2">
							<div>
								<h3 className="font-medium text-sm">
									{t("capabilities.packsTitle")}
								</h3>
								<p className="text-muted-foreground text-xs">
									{t("capabilities.packsHelp")}
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								disabled={packsLoading}
								aria-label={t("capabilities.refreshPacks")}
								onClick={() => void reloadPacks()}
							>
								<RefreshCwIcon
									className={
										packsLoading
											? "size-4 animate-spin"
											: "size-4"
									}
								/>
							</Button>
						</div>

						<div className="flex flex-col gap-3">
							{packsLoading && packs.length === 0 && (
								<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
							)}
							{!packsLoading && packs.length === 0 && (
								<p className="text-muted-foreground text-xs">
									{t("capabilities.noPacks")}
								</p>
							)}
							{packs.map((pack) => {
								const enabled = room.packs.includes(pack.id);
								const missing = (pack.requires ?? []).filter(
									(r) => !attachedTypes.has(r),
								);
								const asks = pack.askCount;
								return (
									<div
										key={pack.id}
										className="flex items-start justify-between gap-3 rounded-md border p-3"
									>
										<div className="flex flex-col gap-1">
											<div className="flex flex-wrap items-center gap-2">
												<span className="font-medium text-sm">
													{pack.label}
												</span>
												<Badge
													variant="outline"
													className="text-[10px]"
												>
													{t(
														"capabilities.toolCount",
														{
															count: pack.toolCount,
														},
													)}
												</Badge>
												{asks > 0 && (
													<Badge
														variant="outline"
														className="text-[10px]"
													>
														{t(
															"capabilities.askCount",
															{ count: asks },
														)}
													</Badge>
												)}
											</div>
											<p className="text-muted-foreground text-xs">
												{pack.description}
											</p>
											{enabled && missing.length > 0 && (
												<p className="flex items-center gap-1 text-amber-600 text-xs dark:text-amber-500">
													<AlertTriangleIcon className="size-3 shrink-0" />
													{t(
														"capabilities.needsEngine",
														{
															types: missing.join(
																", ",
															),
														},
													)}
												</p>
											)}
										</div>
										<Switch
											checked={enabled}
											disabled={pendingPack === pack.id}
											onCheckedChange={(next) =>
												void togglePack(pack, next)
											}
											aria-label={pack.label}
										/>
									</div>
								);
							})}
						</div>
					</section>
				</div>
			</ScrollArea>
		);
	},
);
