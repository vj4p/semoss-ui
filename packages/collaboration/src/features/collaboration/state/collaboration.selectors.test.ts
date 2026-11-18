import { createInitialCollaborationState } from "./collaboration.fixtures";
import { selectWorkItems } from "./collaboration.selectors";
import type { CollaborationState, WorkItem } from "./collaboration.types";

/** A state holding exactly these items, each on a thread that is neither muted nor automated. */
const stateWith = (
	items: Array<Partial<WorkItem> & { id: string }>,
): CollaborationState => {
	const base = createInitialCollaborationState();
	const seed = base.items[0];
	return {
		...base,
		threads: base.threads.map((thread) => ({
			...thread,
			muted: false,
			automated: false,
		})),
		items: items.map((item, index) => ({
			...seed,
			threadId: base.threads[0].id,
			askType: "reply",
			status: "open",
			suggested: undefined,
			priority: null,
			score: null,
			due: null,
			received: `2026-10-0${index + 1}T10:00:00Z`,
			isSample: false,
			topicIds: [],
			...item,
		})),
	};
};

const ids = (items: WorkItem[]) => items.map((item) => item.id).sort();

describe("selectWorkItems views follow the server's", () => {
	const state = stateWith([
		{ id: "reply", askType: "reply" },
		{ id: "approve", askType: "approve" },
		{ id: "fyi", askType: "fyi" },
		{ id: "waiting-on-open", askType: "waiting_on", status: "open" },
		{ id: "waiting-status", askType: "reply", status: "waiting" },
		{ id: "suggested", askType: "reply", suggested: true },
		{ id: "handed-off", askType: "reply", assignee: "person-1" },
		{ id: "done", askType: "reply", status: "done" },
	]);

	it("needs_me leaves out FYI, what you are waiting on, what is handed to someone, and what the classifier is unsure of", () => {
		expect(ids(selectWorkItems(state, { view: "needs_me" }).items)).toEqual(
			["approve", "reply"],
		);
	});

	it("waiting holds a waiting item, an open item whose ask is waiting on someone, and one handed to a person", () => {
		expect(ids(selectWorkItems(state, { view: "waiting" }).items)).toEqual([
			"handed-off",
			"waiting-on-open",
			"waiting-status",
		]);
	});

	it("an item is never in both needs_me and waiting", () => {
		const needs = ids(selectWorkItems(state, { view: "needs_me" }).items);
		const waiting = ids(selectWorkItems(state, { view: "waiting" }).items);
		expect(needs.filter((id) => waiting.includes(id))).toEqual([]);
	});

	it("suggested still lists the unsure items", () => {
		expect(
			ids(selectWorkItems(state, { view: "suggested" }).items),
		).toEqual(["suggested"]);
	});
});
