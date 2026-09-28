import { useMemo } from "react";
import {
	type ApprovalKeyLabels,
	actionLabel,
	describeArguments,
	type RunEntry,
	type Session,
	type Translate,
} from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";
import {
	isRequestUserInputAction,
	type PendingAgentAction,
	parseUserInputRequest,
} from "@semoss/sdk/react";
import {
	AgentUserInputCard,
	Button,
	FieldLegend,
	FieldSet,
	Kbd,
} from "@semoss/ui/next";
import { APPROVAL_KEYS } from "@/utility";
import { ArgumentList } from "./argument-list";

/**
 * The key that does what a button does, after the button's label. It takes
 * the button's text colour, whatever the variant. A screen reader skips it:
 * the hint the announcer reads names the keys already.
 */
const KeyCap = ({ label }: { label: string }) => (
	<Kbd
		aria-hidden="true"
		className="border border-current/30 bg-transparent text-current"
	>
		{label}
	</Kbd>
);

/**
 * A tool call waiting for approval, with the buttons that decide it: a
 * fieldset, so that a screen reader names the tool along with the buttons.
 *
 * Every argument is shown whole, the telling one first, and with any
 * invisible character revealed, so that what the user approves is what they
 * read. The call the keys act on shows them on its buttons once they work.
 */
const Approval = ({
	action,
	run,
	session,
	translate,
	keys,
	returnFocus,
	onEdit,
}: {
	action: PendingAgentAction;
	run: RunEntry;
	session: Session;
	translate: Translate;
	keys?: ApprovalKeyLabels;
	returnFocus: () => void;
	onEdit: (text: string) => void;
}) => {
	const { t } = useTranslation("code");
	const args = describeArguments(action.toolArgs);
	return (
		<FieldSet className="min-w-0 gap-3">
			<FieldLegend variant="label" className="mb-2 break-words">
				{translate("run.awaitingApproval", {
					tool: actionLabel(action, run.items),
				})}
			</FieldLegend>
			{args.length === 0 ? (
				<p className="text-muted-foreground">
					{t("approval.noArguments")}
				</p>
			) : (
				<ArgumentList
					args={args}
					data-testid="pendingActions-arguments-list"
				/>
			)}
			<div className="flex flex-wrap gap-2">
				<Button
					size="sm"
					onClick={() => {
						returnFocus();
						void session.approve(action);
					}}
					data-testid="pendingActions-approve-button"
				>
					{t("action.approve")}
					{keys !== undefined && <KeyCap label={keys.approve} />}
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => {
						returnFocus();
						void session.deny(action);
					}}
					data-testid="pendingActions-deny-button"
				>
					{t("action.deny")}
					{keys !== undefined && <KeyCap label={keys.deny} />}
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => {
						returnFocus();
						const text = session.startEdit(action);
						if (text !== undefined) {
							onEdit(text);
						}
					}}
					data-testid="pendingActions-edit-button"
				>
					{t("action.edit")}
					{keys !== undefined && <KeyCap label={keys.edit} />}
				</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => {
						returnFocus();
						void session.alwaysAllow(action);
					}}
					data-testid="pendingActions-alwaysAllow-button"
				>
					{t("action.alwaysAllow")}
					{keys !== undefined && <KeyCap label={keys.always} />}
				</Button>
			</div>
		</FieldSet>
	);
};

/**
 * A question the agent asked, as the platform's form for it. A question that
 * form cannot show can still be dismissed, which rejects it, so that the run
 * is not left waiting on something the user cannot answer.
 */
const Question = ({
	action,
	session,
	translate,
	returnFocus,
}: {
	action: PendingAgentAction;
	session: Session;
	translate: Translate;
	returnFocus: () => void;
}) => {
	const { t } = useTranslation("code");
	const request = useMemo(() => parseUserInputRequest(action), [action]);
	return (
		<FieldSet className="min-w-0">
			<FieldLegend variant="label" className="mb-2">
				{translate("run.awaitingAnswer")}
			</FieldLegend>
			{request === null ? (
				<div className="flex flex-wrap items-center gap-2">
					<p className="min-w-0 flex-1 text-muted-foreground">
						{t("question.invalid")}
					</p>
					<Button
						size="sm"
						variant="outline"
						onClick={() => {
							returnFocus();
							void session.deny(action);
						}}
						data-testid="pendingActions-dismiss-button"
					>
						{t("question.dismiss")}
					</Button>
				</div>
			) : (
				<AgentUserInputCard
					request={request}
					onSubmit={async (answers) => {
						returnFocus();
						await session.respond(action, answers);
					}}
				/>
			)}
		</FieldSet>
	);
};

/**
 * What the run in progress is waiting on the user for: tool calls to approve
 * or deny, and questions to answer.
 *
 * Deciding one sends focus back to the prompt before the decision goes out.
 * The session takes the action off the list at once, so the button pressed
 * is about to disappear, and focus would otherwise fall to the page. Edit
 * puts the call's arguments in the prompt, as an `:edit` line to change and
 * send, and Always allow approves the call and every later one of its tool.
 *
 * The same decisions can be made from the prompt, with `:approve`, `:deny`,
 * `:edit` and `:always`, and with a key once the call the keys act on is
 * ready, when its buttons show them. The announcer tells a screen reader
 * user whichever the transcript's hint does.
 *
 * The list takes at most a third of the console's height and scrolls past
 * that, and is never squeezed below what it shows, so that at 200% zoom an
 * action stays in view and the transcript keeps its share.
 *
 * @name PendingActions
 * @param props.run - The run in progress.
 * @param props.session - The session that decides the actions.
 * @param props.translate - Translate for agent-core's messages.
 * @param props.ready - The call the approval keys may decide, once it is
 * ready for them.
 * @param props.returnFocus - Moves focus back to the prompt.
 * @param props.onEdit - Puts text in the prompt, for Edit.
 */
export const PendingActions = ({
	run,
	session,
	translate,
	ready,
	returnFocus,
	onEdit,
}: {
	run: RunEntry;
	session: Session;
	translate: Translate;
	ready?: PendingAgentAction;
	returnFocus: () => void;
	onEdit: (text: string) => void;
}) => (
	<ul
		className="flex max-h-1/3 shrink-0 flex-col gap-3 overflow-y-auto border-t px-4 py-3 md:px-6"
		data-testid="pendingActions-list"
	>
		{run.pendingActions.map((action) => (
			<li key={action.actionId}>
				{isRequestUserInputAction(action) ? (
					<Question
						action={action}
						session={session}
						translate={translate}
						returnFocus={returnFocus}
					/>
				) : (
					<Approval
						action={action}
						run={run}
						session={session}
						translate={translate}
						keys={
							action.actionId === ready?.actionId
								? APPROVAL_KEYS
								: undefined
						}
						returnFocus={returnFocus}
						onEdit={onEdit}
					/>
				)}
			</li>
		))}
	</ul>
);
