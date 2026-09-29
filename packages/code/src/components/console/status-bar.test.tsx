import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type {
	AllowedTool,
	RunEntry,
	Session,
	SessionState,
} from "@semoss/agent-core";
import { codeResources, I18nBuilder } from "@semoss/i18n";
import type { AgentRunItem, PendingAgentAction } from "@semoss/sdk/react";
import { StatusBar } from "./status-bar";

const builder = new I18nBuilder(codeResources, { lockToEnglish: true });

const state = (alwaysAllowed: AllowedTool[]): SessionState => ({
	catalog: { harnesses: [], models: [] },
	entries: [],
	alwaysAllowed,
});

const call: PendingAgentAction = {
	actionId: "action-1",
	runId: "run-1",
	parentMessageId: null,
	toolCallId: null,
	toolName: "Bash",
	toolArgs: {},
	editedArgs: null,
	toolMeta: null,
	hasUi: false,
	uiUrl: null,
	status: "PENDING",
};

const run = (overrides: Partial<RunEntry> = {}): RunEntry => ({
	kind: "run",
	id: "run-entry-1",
	prompt: "Find the flaky test",
	harness: "semoss",
	modelId: "model-1",
	runId: "run-1",
	status: "RUNNING",
	items: { itemsById: {}, itemOrder: [] },
	droppedEvents: 0,
	pendingActions: [],
	startedAt: 1,
	...overrides,
});

const session = {
	setHarness: vi.fn<Session["setHarness"]>(async () => true),
	setModel: vi.fn<Session["setModel"]>(async () => true),
} satisfies Partial<Session> as unknown as Session;

beforeAll(async () => {
	await builder.ready;
});

describe("StatusBar", () => {
	it("lists the tools that run without asking", () => {
		render(
			<StatusBar
				state={state([
					{ toolName: "Bash", label: "Bash" },
					{ toolName: "a1b2_search", label: "search" },
				])}
				session={session}
			/>,
		);

		const list = screen.getByRole("list", { name: "Always allowed" });
		expect(
			within(list)
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["Bash", "search"]);
	});

	it("leaves the list out while every tool asks", () => {
		render(<StatusBar state={state([])} session={session} />);

		expect(
			screen.queryByTestId("statusBar-alwaysAllowed-list"),
		).not.toBeInTheDocument();
		expect(screen.queryByText("Always allowed")).not.toBeInTheDocument();
	});

	describe("says what the console is doing:", () => {
		it("ready, with nothing running or waiting", () => {
			render(<StatusBar state={state([])} session={session} />);

			expect(screen.getByText("ready")).toBeVisible();
		});

		it("waiting for you, when a subagent waits after its parent ended", () => {
			const item: AgentRunItem = {
				id: "child-1",
				kind: "subagent",
				childRunId: "child-1",
				alias: "reviewer",
				roomId: "room-child-1",
				status: "INPUT_REQUIRED",
			};
			const ended = run({
				status: "COMPLETED",
				endedAt: 2,
				items: { itemsById: { [item.id]: item }, itemOrder: [item.id] },
				subagents: {
					"child-1": {
						followed: true,
						runId: "child-1",
						status: "INPUT_REQUIRED",
						items: { itemsById: {}, itemOrder: [] },
						droppedEvents: 0,
						pendingActions: [{ ...call, runId: "child-1" }],
					},
				},
			});

			render(
				<StatusBar
					state={{ ...state([]), entries: [ended] }}
					session={session}
				/>,
			);

			expect(screen.getByText("waiting for you")).toBeVisible();
		});

		it("stopping, ahead of a call still waiting", () => {
			const stopping = run({
				status: "INPUT_REQUIRED",
				stopRequested: true,
				pendingActions: [call],
			});

			render(
				<StatusBar
					state={{
						...state([]),
						entries: [stopping],
						activeEntryId: stopping.id,
					}}
					session={session}
				/>,
			);

			expect(screen.getByText("stopping")).toBeVisible();
		});
	});
});
