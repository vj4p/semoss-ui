import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { RunEntry, Session, SessionState } from "@semoss/agent-core";
import { codeResources, I18nBuilder } from "@semoss/i18n";
import type { PendingAgentAction } from "@semoss/sdk/react";
import { type PromptHandle, PromptInput } from "./prompt-input";

const builder = new I18nBuilder(codeResources, { lockToEnglish: true });

const EDIT = ':edit {\n  "command": "ls"\n}';

const action = (actionId: string): PendingAgentAction => ({
	actionId,
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
});

const run = (pendingActions: PendingAgentAction[]): RunEntry => ({
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

/** A session whose run in progress waits on these calls. */
const waitingOn = (...pendingActions: PendingAgentAction[]) => {
	const state: SessionState = {
		catalog: { harnesses: [], models: [] },
		entries: [run(pendingActions)],
		activeEntryId: "run-entry-1",
		alwaysAllowed: [],
	};
	const fake = {
		getState: vi.fn<Session["getState"]>(() => state),
		approve: vi.fn<Session["approve"]>(async () => true),
		deny: vi.fn<Session["deny"]>(async () => true),
		alwaysAllow: vi.fn<Session["alwaysAllow"]>(async () => true),
		startEdit: vi.fn<Session["startEdit"]>(() => EDIT),
	} satisfies Partial<Session>;
	return { fake, session: fake as unknown as Session };
};

const mount = (session: Session, ready?: PendingAgentAction) => {
	const handleRef = createRef<PromptHandle>();
	render(
		<PromptInput
			session={session}
			running
			ready={ready}
			inputRef={createRef<HTMLTextAreaElement>()}
			handleRef={handleRef}
		/>,
	);
	return {
		handleRef,
		prompt: screen.getByRole("textbox", { name: "Prompt or command" }),
	};
};

beforeAll(async () => {
	await builder.ready;
});

describe("PromptInput", () => {
	it("approves the ready call with A", () => {
		const call = action("action-1");
		const { fake, session } = waitingOn(call);
		const { prompt } = mount(session, call);

		expect(fireEvent.keyDown(prompt, { key: "a" })).toBe(false);
		expect(fake.approve).toHaveBeenCalledWith(call);
	});

	it("lets A type while the call is not ready yet", () => {
		const { fake, session } = waitingOn(action("action-1"));
		const { prompt } = mount(session);

		expect(fireEvent.keyDown(prompt, { key: "a" })).toBe(true);
		expect(fake.approve).not.toHaveBeenCalled();
	});

	it("lets A type into a prompt that has text in it", () => {
		const call = action("action-1");
		const { fake, session } = waitingOn(call);
		const { prompt } = mount(session, call);
		fireEvent.change(prompt, { target: { value: "l" } });

		expect(fireEvent.keyDown(prompt, { key: "a" })).toBe(true);
		expect(fake.approve).not.toHaveBeenCalled();
	});

	it("lets A type once the session waits on another call than the ready one", () => {
		const { fake, session } = waitingOn(action("action-2"));
		const { prompt } = mount(session, action("action-1"));

		expect(fireEvent.keyDown(prompt, { key: "a" })).toBe(true);
		expect(fake.approve).not.toHaveBeenCalled();
	});

	it("denies with D, and always allows with Shift+A", () => {
		const call = action("action-1");
		const { fake, session } = waitingOn(call);
		const { prompt } = mount(session, call);

		expect(fireEvent.keyDown(prompt, { key: "d" })).toBe(false);
		expect(fake.deny).toHaveBeenCalledWith(call);
		expect(fireEvent.keyDown(prompt, { key: "A", shiftKey: true })).toBe(
			false,
		);
		expect(fake.alwaysAllow).toHaveBeenCalledWith(call);
		expect(fake.approve).not.toHaveBeenCalled();
	});

	it("puts the call's arguments in the prompt with E", () => {
		const call = action("action-1");
		const { fake, session } = waitingOn(call);
		const { prompt } = mount(session, call);

		expect(fireEvent.keyDown(prompt, { key: "e" })).toBe(false);
		expect(fake.startEdit).toHaveBeenCalledWith(call);
		expect(prompt).toHaveValue(EDIT);
	});

	it("names the keys in the placeholder once the call is ready", () => {
		const call = action("action-1");
		const { session } = waitingOn(call);
		const { prompt } = mount(session, call);

		expect(prompt).toHaveAttribute(
			"placeholder",
			"A approve, D deny, E edit, Shift+A always allow",
		);
	});

	it("keeps the usual placeholder until then", () => {
		const { session } = waitingOn(action("action-1"));
		const { prompt } = mount(session);

		expect(prompt).toHaveAttribute(
			"placeholder",
			"Type a prompt, or :help",
		);
	});

	it("lets the console fill it", () => {
		const { session } = waitingOn();
		const { handleRef, prompt } = mount(session);

		act(() => {
			handleRef.current?.fill(EDIT);
		});

		expect(prompt).toHaveValue(EDIT);
	});
});
