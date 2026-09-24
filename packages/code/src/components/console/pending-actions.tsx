import { useMemo } from "react";
import {
	actionLabel,
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
} from "@semoss/ui/next";

/**
 * A tool call waiting for approval, with the buttons that decide it: a
 * fieldset, so that a screen reader names the tool along with the buttons.
 */
const Approval = ({
	action,
	run,
	session,
	translate,
	returnFocus,
}: {
	action: PendingAgentAction;
	run: RunEntry;
	session: Session;
	translate: Translate;
	returnFocus: () => void;
}) => {
	const { t } = useTranslation("code");
	return (
		<FieldSet className="min-w-0">
			<FieldLegend variant="label" className="mb-2 break-words">
				{translate("run.awaitingApproval", {
					tool: actionLabel(action, run.items),
				})}
			</FieldLegend>
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
 * is about to disappear, and focus would otherwise fall to the page. The
 * same decisions can be made from the prompt with `:approve` and `:deny`,
 * which is what the announcer tells a screen reader user to type.
 *
 * The list takes at most a third of the console's height and scrolls past
 * that, and is never squeezed below what it shows, so that at 200% zoom an
 * action stays in view and the transcript keeps its share.
 *
 * @name PendingActions
 * @param props.run - The run in progress.
 * @param props.session - The session that decides the actions.
 * @param props.translate - Translate for agent-core's messages.
 * @param props.returnFocus - Moves focus back to the prompt.
 */
export const PendingActions = ({
	run,
	session,
	translate,
	returnFocus,
}: {
	run: RunEntry;
	session: Session;
	translate: Translate;
	returnFocus: () => void;
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
						returnFocus={returnFocus}
					/>
				)}
			</li>
		))}
	</ul>
);
