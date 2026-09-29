/**
 * Every user-facing string agent-core produces, as data.
 *
 * agent-core cannot own an i18n library: the web host translates with i18next,
 * a CLI host might not translate at all, and either choice here would be forced
 * on the other. So nothing in this library writes prose directly. It asks a
 * {@link Translate} function the host passes in, and falls back to
 * {@link translateEnglish}, which reads this catalog.
 *
 * The catalog doubles as the contract. Its keys are exactly the keys a host's
 * own catalog must define, which is what lets a host test for drift instead of
 * discovering a missing translation in production.
 *
 * Two formats are borrowed from i18next on purpose, so the web host can pass
 * its `t` straight through: keys are dotted paths into nested JSON, and
 * parameters are written `{{name}}`.
 *
 * Counts are passed as `n`, never `count`. i18next treats a `count` parameter
 * as a request for plural forms (`key_one`, `key_other`, and six forms in
 * Arabic), which this catalog does not define. Every sentence that carries a
 * number is phrased so it reads correctly for any value instead.
 *
 * Command names (`:approve`, `:help`) inside these strings are syntax, not
 * prose, and stay untranslated in every language.
 */
export const MESSAGES = {
	"transcript.droppedEvents":
		"Earlier events were dropped from the live feed ({{n}}).",
	"transcript.unknownItem": "This item cannot be shown here ({{kind}}).",
	"transcript.subagent": "subagent {{id}}",

	"run.failed": "Run failed: {{message}}",
	"run.failedUnknown": "Run failed. The server gave no reason.",
	"run.cancelled": "Run cancelled.",
	"run.lost":
		"Lost contact with this run. It may still be running on the server.",
	"run.startFailed": "Could not start the run: {{message}}",
	"run.awaitingApproval": "{{tool}} is waiting for approval.",
	"run.approvalHint": "Type :approve to allow it, or :deny to reject it.",
	"run.approvalKeys":
		"With the prompt empty, press {{approve}} to allow it, {{deny}} to reject it, {{edit}} to change its arguments, or {{always}} to always allow it.",
	"run.awaitingAnswer": "The agent is asking for your input.",
	"run.stopping": "Stopping…",
	"run.reconnecting": "Cannot reach the server. Retrying… ({{message}})",
	"run.subagentTooDeep":
		"Its steps are not shown: subagents are followed to a depth of {{n}}.",
	"run.subagentLimit":
		"Its steps are not shown: subagents are followed at most {{n}} at a time.",
	"run.subagentFailed": "Its steps cannot be shown: {{message}}",
	"run.parentEnded":
		"The parent run has ended and will not use this subagent's result. Deciding lets the subagent carry on, and what it does is shown here.",
	"run.subagentAwaitingAnswer": "{{subagent}} is asking for your input.",

	"session.harnessChanged": "harness → {{name}}",
	"session.modelChanged": "model → {{name}}",
	"session.busy":
		"A run is in progress. Wait for it to finish, or type :stop.",
	"session.noModel":
		"No model is available. A model appears here once it is tagged text-generation.",
	"session.noHarness": "No agent harness is available.",
	"session.unknownHarness":
		'No harness named "{{name}}". Type :harness to list them.',
	"session.unknownModel":
		'No model named "{{name}}". Type :model to list them.',
	"session.harnessList": "Harnesses",
	"session.modelList": "Models",
	"session.current": "current",
	"session.switchHarnessHint": "Type :harness followed by a name to switch.",
	"session.switchModelHint":
		"Type :model followed by a name or an id to switch.",
	"session.nothingRunning": "Nothing is running.",
	"session.stopFailed": "Could not stop the run: {{message}}",
	"session.stopSubagentFailed": "Could not stop {{subagent}}: {{message}}",
	"session.nothingPending": "Nothing is waiting for approval.",
	"session.answerInForm":
		"The agent asked a question. Answer it in the form, or type :deny to dismiss it.",
	"session.approved": "Approved {{tool}}.",
	"session.approvedEdited": "Approved {{tool}} with your changes.",
	"session.denied": "Denied {{tool}}.",
	"session.editInvalid": "That is not valid JSON: {{message}}",
	"session.editNotObject": "The arguments must be a JSON object, in braces.",
	"session.editGone":
		"The call you were editing is no longer waiting. Nothing was sent.",
	"session.alwaysAllowed":
		"Approved {{tool}}. It runs without asking until you type :revoke, start a new room or reload.",
	"session.autoApproveFailed":
		"Could not approve {{tool}} automatically: {{message}}. It is waiting for you.",
	"session.cannotAlwaysAllow":
		"{{tool}} cannot be always allowed, so it is asked about every time.",
	"session.allowedList": "Tools that run without asking",
	"session.allowedNone": "No tool runs without asking.",
	"session.revokeHint":
		"Type :revoke followed by a name to be asked about it again, or :revoke alone for every tool.",
	"session.revoked": "{{tool}} will be asked about again.",
	"session.revokedAll": "Every tool will be asked about again.",
	"session.unknownAllowed":
		'No tool named "{{name}}" runs without asking. Type :allowed to list them.',
	"session.decisionFailed": "Could not send the decision: {{message}}",
	"session.saveFailed": "Could not save the room settings: {{message}}",
	"session.newRoom": "New room. It is saved when you send the first prompt.",
	"session.stoppedFollowing":
		"Stopped following the unfinished subagents ({{n}}). They were not stopped on the server.",
	"session.nothingToExport": "No run to export yet.",
	"session.exported": "Exported the events of run {{runId}}.",

	"command.unknown":
		"Unknown command :{{name}}. Type :help to list commands.",
	"command.didYouMean":
		"Unknown command :{{name}}. Did you mean :{{suggestion}}?",
	"command.missingName":
		"Type a command name after the colon, or :help to list commands.",
	"command.usage": "Usage: {{usage}}",
	"command.failed": ":{{name}} failed: {{message}}",

	"command.help": "List commands and keys",
	"command.harness": "Show the harnesses, or switch to one",
	"command.model": "Show the models, or switch to one",
	"command.new": "Start a new room",
	"command.stop": "Stop the running agent",
	"command.clear": "Clear the screen (the room keeps its history)",
	"command.approve": "Allow the tool call that is waiting",
	"command.deny": "Reject the tool call that is waiting",
	"command.edit": "Change the waiting call's arguments, then approve it",
	"command.always":
		"Approve the waiting call, and stop asking about its tool",
	"command.allowed": "List the tools that run without asking",
	"command.revoke":
		"Ask about a tool again, or every tool when none is named",
	"command.files": "Browse files",
	"command.export": "Save the last run's raw events as JSON",

	"help.commands": "Commands",
	"help.keys": "Keys",
	"help.literalColon":
		"To send a prompt that starts with a colon, type two colons.",

	"key.submit": "Send the prompt",
	"key.newline": "New line",
	"key.historyPrev": "Previous prompt",
	"key.historyNext": "Next prompt",
	"key.interrupt": "Stop the running agent",
	"key.clearInput": "Clear the input",
	"key.clearViewport": "Clear the screen",
	"key.cycleHarness": "Next harness",
	"key.approve": "Approve the waiting tool call (prompt empty)",
	"key.deny": "Deny the waiting tool call (prompt empty)",
	"key.edit": "Edit the waiting call's arguments (prompt empty)",
	"key.alwaysAllow":
		"Approve it, and stop asking about its tool (prompt empty)",
} as const;

export type MessageKey = keyof typeof MESSAGES;

export type MessageParams = Readonly<Record<string, string | number>>;

/**
 * The port a host implements to translate agent-core's strings.
 *
 * i18next's `t`, bound to the namespace and prefix the host keeps these keys
 * under, satisfies it directly.
 */
export type Translate = (key: MessageKey, params?: MessageParams) => string;

/**
 * Fill `{{name}}` placeholders from `params`.
 *
 * A placeholder with no matching parameter is left as written rather than
 * blanked, so a missing argument shows up on screen as a visible bug instead
 * of silently vanishing from the sentence.
 */
export const interpolate = (
	template: string,
	params?: MessageParams,
): string =>
	params === undefined
		? template
		: template.replace(
				/\{\{\s*(\w+)\s*\}\}/g,
				(placeholder, name: string) =>
					Object.hasOwn(params, name)
						? String(params[name])
						: placeholder,
			);

/** The default {@link Translate}: this catalog, in English. */
export const translateEnglish: Translate = (key, params) =>
	interpolate(MESSAGES[key], params);
