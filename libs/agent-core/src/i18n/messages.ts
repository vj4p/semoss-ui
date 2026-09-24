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

	"run.failed": "Run failed: {{message}}",
	"run.failedUnknown": "Run failed. The server gave no reason.",
	"run.cancelled": "Run cancelled.",
	"run.lost":
		"Lost contact with this run. It may still be running on the server.",
	"run.startFailed": "Could not start the run: {{message}}",
	"run.awaitingApproval": "{{tool}} is waiting for approval.",
	"run.approvalHint": "Type :approve to allow it, or :deny to reject it.",
	"run.awaitingAnswer": "The agent is asking for your input.",
	"run.stopping": "Stopping…",
	"run.reconnecting": "Cannot reach the server. Retrying… ({{message}})",

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
	"session.nothingPending": "Nothing is waiting for approval.",
	"session.answerInForm":
		"The agent asked a question. Answer it in the form, or type :deny to dismiss it.",
	"session.approved": "Approved {{tool}}.",
	"session.denied": "Denied {{tool}}.",
	"session.decisionFailed": "Could not send the decision: {{message}}",
	"session.saveFailed": "Could not save the room settings: {{message}}",
	"session.newRoom": "New room. It is saved when you send the first prompt.",
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
