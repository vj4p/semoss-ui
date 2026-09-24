import { describe, expect, it } from "vitest";
import {
	createInputHistory,
	historyNext,
	historyPrev,
	type InputHistory,
	recordInput,
} from "./history";

const withEntries = (...entries: string[]) =>
	entries.reduce<InputHistory>(
		(history, entry) => recordInput(history, entry),
		createInputHistory(),
	);

describe("recordInput", () => {
	it("appends what was submitted, trimmed", () => {
		expect(withEntries(" one ", "two").entries).toEqual(["one", "two"]);
	});

	it("skips blank input and an exact repeat of the newest entry", () => {
		expect(withEntries("a", "  ", "a", "b", "a").entries).toEqual([
			"a",
			"b",
			"a",
		]);
	});

	it("keeps only the newest entries past the limit", () => {
		let history = createInputHistory();
		for (const entry of ["1", "2", "3", "4"]) {
			history = recordInput(history, entry, 3);
		}
		expect(history.entries).toEqual(["2", "3", "4"]);
	});

	it("returns to the draft position", () => {
		const walked = historyPrev(withEntries("a"), "draft");
		expect(walked).toBeDefined();
		expect(
			recordInput(walked?.history ?? createInputHistory(), "b"),
		).toMatchObject({ cursor: undefined, draft: "" });
	});
});

describe("historyPrev and historyNext", () => {
	it("walks back from the newest entry to the oldest, then stops", () => {
		const start = withEntries("one", "two");
		const first = historyPrev(start, "");
		expect(first?.text).toBe("two");
		const second = historyPrev(first?.history ?? start, "two");
		expect(second?.text).toBe("one");
		expect(historyPrev(second?.history ?? start, "one")).toBeUndefined();
	});

	it("parks the draft and gives it back past the newest entry", () => {
		const start = withEntries("one", "two");
		const back = historyPrev(start, "half-typed");
		const further = historyPrev(back?.history ?? start, "two");
		const forward = historyNext(further?.history ?? start);
		expect(forward?.text).toBe("two");
		const home = historyNext(forward?.history ?? start);
		expect(home?.text).toBe("half-typed");
		expect(home?.history).toMatchObject({ cursor: undefined, draft: "" });
	});

	it("parks the draft only on the first step back", () => {
		const start = withEntries("one", "two");
		const back = historyPrev(start, "draft");
		// The input now shows "two"; stepping again must not park that.
		const further = historyPrev(back?.history ?? start, "two");
		expect(further?.history.draft).toBe("draft");
	});

	it("does nothing without history, or forward from the draft", () => {
		expect(historyPrev(createInputHistory(), "x")).toBeUndefined();
		expect(historyNext(withEntries("one"))).toBeUndefined();
	});
});
