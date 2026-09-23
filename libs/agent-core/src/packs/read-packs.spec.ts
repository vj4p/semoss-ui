import { describe, expect, it, vi } from "vitest";
import { type PixelRunner, readCapabilityPacks } from "./read-packs";

/**
 * A runner that answers each pixel by pattern, so a test can fail one batch
 * while the others succeed.
 *
 * Keyed on the leading reactor name because the readers batch a variable number
 * of statements into one string — the shape under test is precisely that the
 * results come back positionally, so a test must be able to return a positional
 * array rather than a per-id map.
 */
const runner = (answers: {
	projects?: unknown | Error;
	tools?: unknown[] | Error;
	descriptions?: unknown[] | Error;
}): PixelRunner => ({
	actions: {
		run: (pixel: string) => {
			const pick = () => {
				if (pixel.startsWith("META | MyProjects")) {
					return answers.projects;
				}
				if (pixel.startsWith("GetMCPTools")) {
					return answers.tools;
				}
				return answers.descriptions;
			};
			// Discovery is ONE statement whose single output is the whole rows
			// payload; the other two are batches whose outputs are positional,
			// one per pack. Collapsing that distinction is what an earlier
			// version of this fake did, and it made an assertion pass by
			// returning [] down a path the test did not mean to exercise.
			const positional = !pixel.startsWith("META | MyProjects");
			const answer = pick();
			if (answer instanceof Error) {
				return Promise.reject(answer);
			}
			const outputs =
				positional && Array.isArray(answer) ? answer : [answer];
			return Promise.resolve({
				pixelReturn: outputs.map((output) => ({ output })),
			});
		},
	},
});

const describedFile = (description: string) => [{ description }];

describe("readCapabilityPacks", () => {
	it("returns only pack projects, alphabetically, with counts and labels", async () => {
		const packs = await readCapabilityPacks(
			runner({
				projects: [
					{ project_id: "pack-knowledge" },
					{ project_id: "room-filesystem" },
					{ project_id: "pack-data" },
				],
				tools: [
					{ tools: [{ name: "VectorSearch" }] },
					{
						tools: [
							{ name: "Query" },
							{
								name: "DropTable",
								_meta: { SMSS_MCP_EXECUTION: "ask" },
							},
						],
					},
				],
				descriptions: [
					describedFile("Use when you need to search documents."),
					describedFile("Use when you need to read a schema."),
				],
			}),
		);

		expect(packs).toEqual([
			{
				id: "pack-data",
				label: "Data",
				description: "Read a schema.",
				requires: ["DATABASE"],
				toolCount: 2,
				askCount: 1,
			},
			{
				id: "pack-knowledge",
				label: "Knowledge",
				description: "Search documents.",
				requires: ["VECTOR"],
				toolCount: 1,
				askCount: 0,
			},
		]);
	});

	/**
	 * `room-filesystem` and `reactor-help` are MCP-tagged too, so the discovery
	 * query returns things that are not packs. Counting them would put toolboxes
	 * the platform attaches for its own reasons into a user-facing capability
	 * list.
	 */
	it("ignores MCP projects that are not packs", async () => {
		const packs = await readCapabilityPacks(
			runner({ projects: [{ project_id: "reactor-help" }] }),
		);
		expect(packs).toEqual([]);
	});

	it("reads the rows out of a wrapped payload as well as a bare array", async () => {
		const packs = await readCapabilityPacks(
			runner({
				projects: { data: [{ project_id: "pack-git" }] },
				tools: [{ tools: [] }],
				descriptions: [undefined],
			}),
		);
		expect(packs.map((pack) => pack.id)).toEqual(["pack-git"]);
	});

	/**
	 * Tolerating each batch separately is the point: a pack whose project is
	 * mid-deploy should cost that one dimension, not the whole panel. The pack
	 * still has to appear, or enabling it becomes impossible precisely when
	 * something is already wrong.
	 */
	it("still lists a pack whose tools could not be read", async () => {
		const onError = vi.fn();
		const packs = await readCapabilityPacks(
			runner({
				projects: [{ project_id: "pack-git" }],
				tools: new Error("GetMCPTools exploded"),
				descriptions: [describedFile("Use when you need to commit.")],
			}),
			onError,
		);

		expect(packs).toMatchObject([
			{ id: "pack-git", description: "Commit.", toolCount: 0 },
		]);
		expect(onError).toHaveBeenCalledWith(
			"Could not read the packs' tools",
			expect.any(Error),
		);
	});

	it("still lists a pack whose description could not be read", async () => {
		const onError = vi.fn();
		const packs = await readCapabilityPacks(
			runner({
				projects: [{ project_id: "pack-git" }],
				tools: [{ tools: [{ name: "Commit" }] }],
				descriptions: new Error("ListSkillFiles exploded"),
			}),
			onError,
		);

		expect(packs).toMatchObject([
			{ id: "pack-git", description: "", toolCount: 1 },
		]);
		expect(onError).toHaveBeenCalledWith(
			"Could not read the packs' descriptions",
			expect.any(Error),
		);
	});

	it("yields nothing when discovery itself fails, and says so", async () => {
		const onError = vi.fn();
		const packs = await readCapabilityPacks(
			runner({ projects: new Error("no session") }),
			onError,
		);
		expect(packs).toEqual([]);
		expect(onError).toHaveBeenCalledWith(
			"Failed to load capability packs",
			expect.any(Error),
		);
	});

	/**
	 * This library does not log, so a caller that passes no reporter gets
	 * silence. Asserting it does not throw matters because the readers call the
	 * reporter from inside a catch — an undefined call there would turn a
	 * tolerated partial failure into a rejected promise.
	 */
	it("survives a failure with no reporter attached", async () => {
		await expect(
			readCapabilityPacks(runner({ projects: new Error("no session") })),
		).resolves.toEqual([]);
	});
});
