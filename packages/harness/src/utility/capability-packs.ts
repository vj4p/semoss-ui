/**
 * Capability packs — curated bundles of SEMOSS reactors exposed to an agent as
 * tools.
 *
 * ## Why packs and not raw Pixel
 *
 * The `semoss` harness ships 15 native tools and every one of them is a file, a
 * shell command, or a todo. None can call a SEMOSS reactor, so vector search,
 * database queries, frames, git and publishing are all unreachable from inside a
 * run — even though the harness prompt already tells the model to use engine ids
 * and "project-scoped Pixel or tool calls".
 *
 * `MakeRoomPixelMCP` closes that gap without any backend change: it resolves each
 * named reactor through `ReactorFactory` and calls `asMcpTool()`, which derives
 * the JSON schema from the reactor's own `keysToGet`. A `Pixel(code=...)` reactor
 * also exists and would hand over the whole platform in one tool, but it gives up
 * everything worth having: per-reactor RBAC still applies either way, yet only
 * named tools can be individually gated behind human approval, and only named
 * tools give the model a real parameter schema instead of making it write Pixel
 * syntax from memory.
 *
 * ## Execution mode
 *
 * `auto` runs without asking. `ask` routes through the platform's existing
 * human-in-the-loop path — the run parks in `INPUT_REQUIRED`, an `AGENT_RUN_ACTION`
 * row is written, and the user approves, edits, rejects or answers.
 *
 * The line drawn here: `ask` for anything that mutates state the agent's own file
 * tools could not already reach, or that is outward-facing or hard to reverse.
 * Reading a schema is `auto`; pushing to shared cloud storage is `ask`. Pulling a
 * file into the project is `auto` because `WriteFile` is already auto and lands in
 * the same place — gating it would be theatre.
 *
 * `SqlQuery` is the deliberate judgement call. It is `ask` because `commit=true`
 * turns it into an UPDATE, and a caller with edit rights on the database would
 * have those writes go through silently. That costs a round-trip on every read
 * query; flip it to `auto` per deployment if the agent only ever has view rights.
 */

/**
 * How a tool behaves when the model calls it. Mirrors Java `MCPExecution`.
 *
 * `disabled` is never used by a pack — it exists because a tool marked disabled is
 * filtered out before the model is called, which is what makes
 * {@link EMPTY_PACK_TOOLS} possible.
 */
export type PackExecution = "auto" | "ask" | "disabled";

export interface PackReactor {
	/** Pixel reactor name, exactly as `ReactorFactory` registers it. */
	name: string;

	/** Approval behaviour. Defaults to `auto` when omitted. */
	execution?: PackExecution;
}

export interface CapabilityPack {
	/** Stable id persisted in `room.options.packs`. Never rename one. */
	id: string;

	/** Short label for the toggle. */
	label: string;

	/** One line on what the agent gains. Shown under the label. */
	description: string;

	/** Reactors exposed as tools when this pack is on. */
	reactors: PackReactor[];

	/**
	 * Engine types this pack is useless without, so the UI can say so rather than
	 * letting someone enable a pack that has nothing to point at. Matches
	 * `engine_type` from `GetProjectDependencies`.
	 */
	requires?: ("DATABASE" | "VECTOR" | "MODEL" | "STORAGE")[];
}

export const CAPABILITY_PACKS: CapabilityPack[] = [
	{
		id: "data",
		label: "Data",
		description:
			"Read a database's schema, turn a question into SQL, and run it.",
		requires: ["DATABASE"],
		reactors: [
			{ name: "GetOwlDictionary" },
			{ name: "GetDatabaseTableStructure" },
			// Returns SQL as text without executing it, so it is safe to auto-run.
			{ name: "TextToSQL" },
			{ name: "SqlQuery", execution: "ask" },
			{ name: "Collect" },
		],
	},
	{
		id: "rag",
		label: "Knowledge (RAG)",
		description:
			"Search an embedded document store and add documents to it.",
		requires: ["VECTOR"],
		reactors: [
			{ name: "VectorDatabaseQuery" },
			{ name: "ListDocumentsInVectorDatabase" },
			{ name: "Embeddings" },
			{ name: "CreateEmbeddingsFromDocuments", execution: "ask" },
			{ name: "RemoveDocumentFromVectorDatabase", execution: "ask" },
		],
	},
	{
		id: "frames",
		label: "Frames",
		description:
			"Load a file into an in-memory frame, profile it, and read results back.",
		reactors: [
			{ name: "FileRead" },
			{ name: "CreateFrame" },
			{ name: "Import" },
			{ name: "FrameHeaders" },
			{ name: "DescriptiveStats" },
			{ name: "Collect" },
		],
	},
	{
		id: "git",
		label: "Git",
		description: "See and describe its own changes, and work on a branch.",
		reactors: [
			{ name: "ProjectGitStatus" },
			{ name: "ProjectGitDiff" },
			{ name: "ProjectGitBranches" },
			{ name: "ProjectGitCreateBranch", execution: "ask" },
			{ name: "ProjectGitStage", execution: "ask" },
		],
	},
	{
		id: "publish",
		label: "Publish",
		description: "Save the app it built and make it reachable.",
		reactors: [
			{ name: "SaveAppBlocksJson", execution: "ask" },
			{ name: "PublishProject", execution: "ask" },
			{ name: "BuildAndPublishApp", execution: "ask" },
		],
	},
	{
		id: "storage",
		label: "Storage",
		description:
			"Pull a dataset in from S3, SharePoint, SFTP and friends — or push one back.",
		requires: ["STORAGE"],
		reactors: [
			{ name: "ListStoragePath" },
			{ name: "ListStoragePathDetails" },
			// No stricter than WriteFile: it lands a file in the same space.
			{ name: "PullFromStorage" },
			{ name: "PushToStorage", execution: "ask" },
			{ name: "DeleteFromStorage", execution: "ask" },
		],
	},
];

const PACKS_BY_ID = new Map(CAPABILITY_PACKS.map((p) => [p.id, p]));

/**
 * Flatten the enabled packs into the single reactor list `MakeRoomPixelMCP`
 * expects.
 *
 * One call must carry **every** reactor the room should have. The reactor treats
 * the names it is given as the complete set it owns and drops anything it wrote
 * before and was not asked for again, so applying one pack at a time would
 * silently delete the previous pack's tools.
 *
 * Reactors shared between packs (`Collect` is in two) are deduped, because the
 * builder would otherwise emit a second tool under a uniquified name. Where two
 * packs disagree about approval, the stricter mode wins — a reactor should never
 * become auto-run just because it also appears in a gentler pack.
 *
 * @param enabledIds - pack ids from `room.options.packs`; unknown ids ignored.
 * @return Parallel `reactors` and `mcpMetadata` arrays, index-matched as
 *   `PixelMCPToolBuilder` requires (it throws when the lengths differ).
 */
export const resolvePackTools = (
	enabledIds: readonly string[],
): {
	reactors: string[];
	metadata: { SMSS_MCP_EXECUTION: PackExecution }[];
} => {
	const byName = new Map<string, PackExecution>();

	for (const id of enabledIds) {
		const pack = PACKS_BY_ID.get(id);
		if (!pack) continue;
		for (const reactor of pack.reactors) {
			const mode = reactor.execution ?? "auto";
			const existing = byName.get(reactor.name);
			if (existing === "ask" || mode === "ask") {
				byName.set(reactor.name, "ask");
			} else {
				byName.set(reactor.name, existing ?? mode);
			}
		}
	}

	const reactors = [...byName.keys()];
	return {
		reactors,
		metadata: reactors.map((name) => ({
			SMSS_MCP_EXECUTION: byName.get(name) ?? "auto",
		})),
	};
};

/**
 * What to send when every pack is off.
 *
 * `MakeRoomPixelMCP` requires at least one reactor name, so "own nothing" cannot
 * be expressed by sending an empty list. Sending a single reactor marked
 * `disabled` says it exactly: the generator's owned set shrinks to that one entry
 * — dropping every real tool it had written — and a disabled tool is filtered out
 * before the model is called, so the agent is offered nothing.
 *
 * `GetUserInfo` is the placeholder because it takes no arguments and exposes
 * nothing the caller cannot already see, so it is harmless even if some future
 * change started honouring it.
 */
export const EMPTY_PACK_TOOLS: {
	reactors: string[];
	metadata: { SMSS_MCP_EXECUTION: PackExecution }[];
} = {
	reactors: ["GetUserInfo"],
	metadata: [{ SMSS_MCP_EXECUTION: "disabled" }],
};

/** Look up a pack by its persisted id. */
export const getCapabilityPack = (id: string): CapabilityPack | undefined =>
	PACKS_BY_ID.get(id);
