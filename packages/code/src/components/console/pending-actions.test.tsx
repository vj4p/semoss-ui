import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	type RunEntry,
	type RunStatus,
	type Session,
	translateEnglish,
	waitingIn,
} from "@semoss/agent-core";
import { codeResources, I18nBuilder } from "@semoss/i18n";
import type { AgentRunItem, PendingAgentAction } from "@semoss/sdk/react";
import { PendingActions } from "./pending-actions";

const builder = new I18nBuilder(codeResources, { lockToEnglish: true });

const EDIT = ':edit {\n  "command": "ls"\n}';

const action = (
	overrides: Partial<PendingAgentAction> = {},
): PendingAgentAction => ({
	actionId: "action-1",
	runId: "run-1",
	parentMessageId: null,
	toolCallId: null,
	toolName: "Bash",
	toolArgs: { command: "ls" },
	editedArgs: null,
	toolMeta: null,
	hasUi: false,
	uiUrl: null,
	status: "PENDING",
	...overrides,
});

const run = (...pendingActions: PendingAgentAction[]): RunEntry => ({
	kind: "run",
	id: "run-entry-1",
	prompt: "Find the flaky test",
	harness: "semoss",
	modelId: "model-1",
	runId: "run-1",
	status: "INPUT_REQUIRED",
	items: { itemsById: {}, itemOrder: [] },
	droppedEvents: 0,
	pendingActions,
	startedAt: 1,
});

/**
 * A run in `status` that spawned `reviewer`, which the console follows and
 * which is waiting on `pendingActions`.
 */
const withReviewer = (
	status: RunStatus,
	...pendingActions: PendingAgentAction[]
): RunEntry => {
	const item: AgentRunItem = {
		id: "child-1",
		kind: "subagent",
		childRunId: "child-1",
		alias: "reviewer",
		roomId: "room-child-1",
		status: "INPUT_REQUIRED",
	};
	return {
		...run(),
		status,
		items: { itemsById: { [item.id]: item }, itemOrder: [item.id] },
		subagents: {
			"child-1": {
				followed: true,
				runId: "child-1",
				status: "INPUT_REQUIRED",
				items: { itemsById: {}, itemOrder: [] },
				droppedEvents: 0,
				pendingActions,
			},
		},
	};
};

const PARENT_ENDED =
	"The parent run has ended and will not use this subagent's result. Deciding lets the subagent carry on, and what it does is shown here.";

/** A session, and the order in which the card called it and the console. */
const fakeSession = () => {
	const calls: string[] = [];
	const fake = {
		approve: vi.fn<Session["approve"]>(async () => true),
		deny: vi.fn<Session["deny"]>(async () => true),
		alwaysAllow: vi.fn<Session["alwaysAllow"]>(async () => {
			calls.push("alwaysAllow");
			return true;
		}),
		startEdit: vi.fn<Session["startEdit"]>(() => {
			calls.push("startEdit");
			return EDIT;
		}),
	} satisfies Partial<Session>;
	const returnFocus = vi.fn(() => {
		calls.push("returnFocus");
	});
	const onEdit = vi.fn((text: string) => {
		calls.push(`onEdit ${text}`);
	});
	return {
		calls,
		fake,
		session: fake as unknown as Session,
		returnFocus,
		onEdit,
	};
};

const mount = (
	entry: RunEntry,
	ready?: PendingAgentAction,
	fakes = fakeSession(),
) => {
	render(
		<PendingActions
			waiting={waitingIn(entry)}
			session={fakes.session}
			translate={translateEnglish}
			ready={ready}
			returnFocus={fakes.returnFocus}
			onEdit={fakes.onEdit}
		/>,
	);
	return fakes;
};

/** The card for a waiting call of this tool. */
const card = (tool: string) =>
	screen.getByRole("group", { name: `${tool} is waiting for approval.` });

beforeAll(async () => {
	await builder.ready;
});

describe("PendingActions", () => {
	it("shows every argument, the telling one first", () => {
		mount(
			run(action({ toolArgs: { cwd: "/repo", command: "git status" } })),
		);

		const list = screen.getByTestId("pendingActions-arguments-list");
		expect(
			within(list)
				.getAllByRole("term")
				.map((term) => term.textContent),
		).toEqual(["command", "cwd"]);
		expect(
			within(list)
				.getAllByRole("definition")
				.map((definition) => definition.textContent),
		).toEqual(["git status", "/repo"]);
	});

	it("reveals an invisible character in an argument", () => {
		const override = String.fromCodePoint(0x202e);
		mount(run(action({ toolArgs: { command: `echo ${override}txt` } })));

		expect(screen.getByRole("definition")).toHaveTextContent(
			`echo ${String.fromCodePoint(0x27e8)}U+202E${String.fromCodePoint(0x27e9)}txt`,
		);
	});

	it("says so when the call has no arguments", () => {
		mount(run(action({ toolArgs: {} })));

		expect(within(card("Bash")).getByText("No arguments")).toBeVisible();
	});

	it("sends focus back, then puts the call's arguments in the prompt, on Edit", () => {
		const call = action();
		const { calls, fake } = mount(run(call));

		fireEvent.click(screen.getByRole("button", { name: "Edit" }));

		expect(fake.startEdit).toHaveBeenCalledWith(call);
		expect(calls).toEqual(["returnFocus", "startEdit", `onEdit ${EDIT}`]);
	});

	it("sends focus back, then always allows the call's tool, on Always allow", () => {
		const call = action();
		const { calls, fake } = mount(run(call));

		fireEvent.click(screen.getByRole("button", { name: "Always allow" }));

		expect(fake.alwaysAllow).toHaveBeenCalledWith(call);
		expect(calls).toEqual(["returnFocus", "alwaysAllow"]);
	});

	it("shows the keys only on the ready call's buttons, and not to a screen reader", () => {
		const first = action({ actionId: "action-1", toolName: "Bash" });
		const second = action({ actionId: "action-2", toolName: "Write" });
		mount(run(first, second), first);

		const ready = card("Bash");
		expect(
			within(ready)
				.getAllByRole("button")
				.map((button) => [
					button.textContent,
					button.querySelector("kbd")?.getAttribute("aria-hidden"),
				]),
		).toEqual([
			["ApproveA", "true"],
			["DenyD", "true"],
			["EditE", "true"],
			["Always allowShift+A", "true"],
		]);
		for (const name of ["Approve", "Deny", "Edit", "Always allow"]) {
			expect(within(ready).getByRole("button", { name })).toBeVisible();
		}
		expect(card("Write").querySelector("kbd")).toBeNull();
	});

	describe("a subagent's", () => {
		const childCall = action({
			actionId: "child-action",
			runId: "child-1",
		});

		it("call is named by its path, and decided with the subagent's action", () => {
			const { fake } = mount(withReviewer("RUNNING", childCall));
			const group = card("reviewer › Bash");

			expect(group).not.toHaveAccessibleDescription();

			fireEvent.click(
				within(group).getByRole("button", { name: "Approve" }),
			);

			expect(fake.approve).toHaveBeenCalledWith(childCall);
		});

		it("call says so, as its description, once the parent has ended", () => {
			mount(withReviewer("COMPLETED", childCall));

			expect(card("reviewer › Bash")).toHaveAccessibleDescription(
				PARENT_ENDED,
			);
		});

		it("question names the subagent, and can still be dismissed", () => {
			// With no questions to show, the platform's form cannot draw it.
			const question = action({
				actionId: "child-question",
				runId: "child-1",
				toolName: "request_user_input",
				toolArgs: {},
			});
			const { fake } = mount(withReviewer("COMPLETED", question));
			const group = screen.getByRole("group", {
				name: "reviewer is asking for your input.",
			});

			expect(group).toHaveAccessibleDescription(PARENT_ENDED);

			fireEvent.click(
				within(group).getByRole("button", { name: "Dismiss" }),
			);

			expect(fake.deny).toHaveBeenCalledWith(question);
		});
	});
});
