import { useCallback, useEffect, useState } from "react";
import { useInsight } from "@semoss/sdk/react";
import type { PackTool } from "@/utility";
import {
	buildCapabilityPack,
	type CapabilityPack,
	isPackProject,
} from "@/utility";

/**
 * One MCP-tagged project as `META | MyProjects` returns it.
 *
 * `project_name` is not the pack's name — every seeded platform project is named
 * `platform` — so only the id and description are of use here.
 */
interface McpProjectRow {
	project_id?: string;
	description?: string;
}

/**
 * Minimal slice of the insight the pack readers need.
 *
 * Untyped output on purpose: these batch a variable number of statements, so the
 * tuple type `run` is usually given cannot describe the result, and each reader
 * narrows its own entries.
 */
type PixelRunner = {
	actions: {
		run: (
			pixel: string,
		) => Promise<{ pixelReturn: { output?: unknown }[] }>;
	};
};

/**
 * Read every pack's tools in one call, keyed by pack id.
 *
 * The results come back positionally, in the order the statements were sent, which
 * is what maps them back to their pack — the tool payload itself does not name the
 * project it came from.
 *
 * @param ids - pack project ids to read.
 * @return tools per pack; empty when the batch could not be read.
 */
const batchReadPackTools = async (
	insight: PixelRunner,
	ids: readonly string[],
): Promise<Map<string, PackTool[]>> => {
	const byPack = new Map<string, PackTool[]>();
	try {
		const { pixelReturn } = await insight.actions.run(
			ids
				.map((id) => `GetMCPTools(project=[${JSON.stringify(id)}]);`)
				.join(""),
		);
		ids.forEach((id, index) => {
			const output = pixelReturn[index]?.output as
				| { tools?: PackTool[] }
				| PackTool[]
				| undefined;
			byPack.set(
				id,
				Array.isArray(output) ? output : (output?.tools ?? []),
			);
		});
	} catch (e) {
		console.error("Could not read the packs' tools", e);
	}
	return byPack;
};

/**
 * The frontmatter description is phrased for skill selection — "Use when you need to
 * read a database's schema, ... Exposes these as tools you call directly: ..." — which
 * is right for the model choosing a skill and wrong as a line of UI. Both wrappers are
 * stripped to recover the plain sentence underneath: the tail duplicates the tool-count
 * badge shown beside it, and the lead-in is not addressed to the person reading the UI.
 *
 * Neither strip is required to match. A pack whose description is not in this shape is
 * shown as written rather than mangled.
 */
const toDisplayDescription = (frontmatter: string): string => {
	const withoutTools = frontmatter.split(" Exposes these as tools")[0];
	const withoutLeadIn = withoutTools.replace(/^Use when you need to /, "");
	return withoutLeadIn.charAt(0).toUpperCase() + withoutLeadIn.slice(1);
};

/**
 * Read every pack's description in one call, keyed by pack id.
 *
 * @param ids - pack project ids to read.
 * @return description per pack; empty when the batch could not be read.
 */
const batchReadPackDescriptions = async (
	insight: PixelRunner,
	ids: readonly string[],
): Promise<Map<string, string>> => {
	const byPack = new Map<string, string>();
	try {
		const { pixelReturn } = await insight.actions.run(
			ids
				.map(
					(id) =>
						`RunMCPTool(project=[${JSON.stringify(id)}], function=["ListSkillFiles"], paramValues=[{}]);`,
				)
				.join(""),
		);
		ids.forEach((id, index) => {
			const output = pixelReturn[index]?.output as
				| { description?: string }[]
				| undefined;
			const described = output?.find((file) => file.description);
			if (described?.description) {
				byPack.set(id, toDisplayDescription(described.description));
			}
		});
	} catch (e) {
		console.error("Could not read the packs' descriptions", e);
	}
	return byPack;
};

/**
 * Every capability pack visible to the caller, with live tool/ask counts.
 *
 * Shared by the Capabilities panel and the composer's reach strip so the two
 * batched-pixel readers (`GetMCPTools`, the SKILL.md description) exist exactly
 * once. `MyProjects` filtered to the `MCP` tag is both the discovery query and
 * the access check — a pack the caller cannot read is simply not returned.
 *
 * Each batch is tolerated separately: one pack whose project is mid-deploy costs
 * that dimension (no description, or no counts), not the whole list.
 */
export const useRoomPacks = () => {
	const insight = useInsight();
	const [packs, setPacks] = useState<CapabilityPack[]>([]);
	const [loading, setLoading] = useState(false);

	const reload = useCallback(async () => {
		setLoading(true);
		try {
			const { pixelReturn } = await insight.actions.run<
				[McpProjectRow[] | { data?: McpProjectRow[] }]
			>(
				`META | MyProjects(metaKeys=["tag","description"], metaFilters=[{"tag":["MCP"]}], limit=[100], offset=[0]);`,
			);
			const output = pixelReturn[0]?.output;
			const rows = Array.isArray(output) ? output : (output?.data ?? []);
			const ids = rows
				.map((row) => row.project_id)
				.filter((id): id is string => isPackProject(id));

			if (ids.length === 0) {
				setPacks([]);
				return;
			}

			const [toolsByPack, describedByPack] = await Promise.all([
				batchReadPackTools(insight, ids),
				batchReadPackDescriptions(insight, ids),
			]);

			const resolved = ids
				.map((id) =>
					buildCapabilityPack(
						id,
						describedByPack.get(id) ?? "",
						toolsByPack.get(id) ?? [],
					),
				)
				.sort((a, b) => a.label.localeCompare(b.label));
			setPacks(resolved);
		} catch (e) {
			console.error("Failed to load capability packs", e);
			setPacks([]);
		} finally {
			setLoading(false);
		}
	}, [insight]);

	useEffect(() => {
		void reload();
	}, [reload]);

	return { packs, loading, reload };
};
