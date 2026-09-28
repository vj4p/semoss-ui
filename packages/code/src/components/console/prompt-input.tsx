import {
	type KeyboardEvent,
	type Ref,
	type RefObject,
	useId,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import {
	createInputHistory,
	historyNext,
	historyPrev,
	type KeyContext,
	keyedApproval,
	recordInput,
	resolveKey,
	type Session,
} from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";
import type { PendingAgentAction } from "@semoss/sdk/react";
import { Button, Label, Textarea } from "@semoss/ui/next";
import { APPROVAL_KEYS } from "@/utility";

/**
 * What the keymap needs to know about the prompt when a key is pressed.
 *
 * Only the prompt's own selection counts. Ctrl+C copies the selection of
 * whatever has focus, so text selected elsewhere on the page would not be
 * what it copied, and must not stop it interrupting. The caret is on the
 * first or last line only when nothing is selected, so that ↑ and ↓ still
 * collapse a selection rather than recall history.
 */
const keyContext = (
	input: HTMLTextAreaElement,
	running: boolean,
	approvalReady: boolean,
): KeyContext => {
	const { selectionStart, selectionEnd, value } = input;
	const collapsed = selectionStart === selectionEnd;
	return {
		running,
		hasSelection: !collapsed,
		inputEmpty: value.length === 0,
		caretOnFirstLine:
			collapsed && !value.slice(0, selectionStart).includes("\n"),
		caretOnLastLine: collapsed && !value.slice(selectionEnd).includes("\n"),
		approvalReady,
	};
};

/** What the console can do to the prompt, besides focusing it. */
export interface PromptHandle {
	/**
	 * Replace what the prompt holds with text for the user to change and send,
	 * such as the `:edit` line with a tool call's arguments.
	 */
	fill: (text: string) => void;
}

/**
 * The command line: a prompt for the agent, or a `:command` for the console.
 *
 * Enter sends it, Shift+Enter starts a new line, and ↑ and ↓ walk the prompts
 * sent before, from the first and last line. Ctrl+C and Escape stop a run,
 * Ctrl+C with no run clears the line, Ctrl+L clears the screen, and Alt+H
 * switches harness. The keys come from agent-core's keymap, which `:help`
 * lists, so the two cannot disagree.
 *
 * While a tool call waits for approval, A, D, E and Shift+A decide it from an
 * empty prompt: they approve it, deny it, put its arguments here to edit, or
 * always allow its tool. They work only once the console says the call is
 * ready, a moment after it appears, so that a key already on its way types
 * instead, and the placeholder names them from then on. A key decides the
 * call only if it is still the one the keys act on, since the session can
 * move on before the console draws again.
 *
 * A command line rather than a form: there is nothing to validate before it
 * is sent, and what it sends is answered in the transcript, not beside it.
 * The Send and Stop buttons do what Enter and Ctrl+C do, for pointer and
 * touch users.
 *
 * @name PromptInput
 * @param props.session - The session prompts are sent to.
 * @param props.running - Whether a run is in progress.
 * @param props.ready - The tool call the approval keys may decide, once it is
 * ready for them.
 * @param props.inputRef - Ref to the text box, so the console can return
 * focus to it.
 * @param props.handleRef - Ref to what else the console can do to the prompt.
 */
export const PromptInput = ({
	session,
	running,
	ready,
	inputRef,
	handleRef,
}: {
	session: Session;
	running: boolean;
	ready?: PendingAgentAction;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	handleRef?: Ref<PromptHandle>;
}) => {
	const { t } = useTranslation("code");
	const inputId = useId();
	const [text, setText] = useState("");
	const historyRef = useRef(createInputHistory());

	/** Text in the prompt as the user's own draft, off any walk of history. */
	const fill = (value: string) => {
		historyRef.current = createInputHistory(historyRef.current.entries);
		setText(value);
	};

	useImperativeHandle(handleRef, () => ({ fill }));

	const send = async (raw: string) => {
		historyRef.current = recordInput(historyRef.current, raw);
		setText("");
		const result = await session.submit(raw);
		if (result.kind === "refused") {
			// The session said why it was not sent. Give the text back, unless
			// the user has already started typing something else.
			setText((current) => (current === "" ? raw : current));
		}
	};

	const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		const input = event.currentTarget;
		const keyed = keyedApproval(session.getState());
		const target =
			ready !== undefined && keyed?.actionId === ready.actionId
				? keyed
				: undefined;
		const action = resolveKey(
			event.nativeEvent,
			keyContext(input, running, target !== undefined),
		);
		switch (action) {
			case undefined:
			case "newline":
				return;
			case "historyPrev":
			case "historyNext": {
				const step =
					action === "historyPrev"
						? historyPrev(historyRef.current, input.value)
						: historyNext(historyRef.current);
				// With nothing further to walk to, the key moves the caret.
				if (step !== undefined) {
					event.preventDefault();
					historyRef.current = step.history;
					setText(step.text);
				}
				return;
			}
			case "submit":
				event.preventDefault();
				void send(input.value);
				return;
			case "interrupt":
				event.preventDefault();
				void session.interrupt();
				return;
			case "clearInput":
				event.preventDefault();
				historyRef.current = createInputHistory(
					historyRef.current.entries,
				);
				setText("");
				return;
			case "clearViewport":
				event.preventDefault();
				session.clear();
				return;
			case "cycleHarness":
				event.preventDefault();
				void session.cycleHarness();
				return;
			case "approve":
				event.preventDefault();
				void session.approve(target);
				return;
			case "deny":
				event.preventDefault();
				void session.deny(target);
				return;
			case "edit": {
				event.preventDefault();
				const edit = session.startEdit(target);
				if (edit !== undefined) {
					fill(edit);
				}
				return;
			}
			case "alwaysAllow":
				event.preventDefault();
				void session.alwaysAllow(target);
				return;
		}
	};

	const placeholder =
		ready !== undefined && APPROVAL_KEYS !== undefined
			? t("input.approvalPlaceholder", { ...APPROVAL_KEYS })
			: t("input.placeholder");

	return (
		<div className="flex items-start gap-2 border-t px-4 py-3 md:px-6">
			<span aria-hidden="true" className="py-2 text-muted-foreground">
				❯
			</span>
			<Label htmlFor={inputId} className="sr-only">
				{t("input.label")}
			</Label>
			<Textarea
				ref={inputRef}
				id={inputId}
				value={text}
				onChange={(event) => setText(event.target.value)}
				onKeyDown={onKeyDown}
				placeholder={placeholder}
				rows={1}
				dir="auto"
				spellCheck={false}
				autoCapitalize="off"
				autoComplete="off"
				autoCorrect="off"
				className="max-h-48 min-h-9 min-w-0 flex-1 resize-none"
				data-testid="promptInput-textarea"
			/>
			{running && (
				<Button
					variant="outline"
					onClick={() => {
						// Back to the prompt first: this button goes once the run
						// stops, and would take focus with it.
						inputRef.current?.focus();
						void session.interrupt();
					}}
					data-testid="promptInput-stop-button"
				>
					{t("action.stop")}
				</Button>
			)}
			<Button
				onClick={() => {
					inputRef.current?.focus();
					void send(text);
				}}
				data-testid="promptInput-send-button"
			>
				{t("action.send")}
			</Button>
		</div>
	);
};
