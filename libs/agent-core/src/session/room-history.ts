/**
 * A reopened room's earlier turns, as transcript lines.
 *
 * The live transcript is built from a run's event stream, which the backend
 * keeps only while the run is active. Reopening a room reads its persisted
 * messages instead — `GetPlaygroundMessages`, the call the harness makes — and
 * this module turns that other shape into the same lines. Wherever a persisted
 * part has a live equivalent it goes through {@link lineForItem}, so a tool
 * call reads the same whether it was watched or reloaded.
 *
 * <h4>Which messages</h4>
 *
 * A room is a tree, not a list: every message names its parent, and editing a
 * prompt starts a sibling branch. The harness shows one branch — from the
 * root, the most recently added child at every step — and so does this, so a
 * room reads the same in both. Compaction breaks the chain: a message whose
 * parent was summarised away names the summary's leaf in
 * `summaryLeafMessageId` instead, which is the harness's fallback too.
 *
 * <h4>What a reload cannot show</h4>
 *
 * Subagents. The harness rebuilds them from `GetSubagentRuns`, because live
 * subagent items are never persisted; a `SUBAGENT` part is mapped here if one
 * arrives, but a room's persisted messages do not carry them today. A tool call
 * with no recorded result shows as queued, which is what it was when the
 * record stops.
 */

import type { AgentRunItem, AgentRunStatusValue } from "@semoss/sdk";
import { type Translate, translateEnglish } from "../i18n/messages";
import { type Line, textLine } from "../transcript/line";
import { lineForItem } from "../transcript/transcript";

export interface RoomHistoryToolCall {
	id: string;
	/** The name the model called, which may carry the MCP routing alias. */
	name: string;
	original_name?: string;
	title?: string;
	arguments?: Record<string, unknown>;
	_meta?: Record<string, unknown>;
}

export interface RoomHistoryToolResult {
	toolCallId: string;
	output?: string;
	toolStatus?: string;
}

/**
 * The parts of a persisted message this module reads, typed structurally so
 * that the harness's `PixelMessage` parts and the raw pixel output both fit.
 */
export type RoomHistoryPart =
	| { type: "TEXT"; text?: string; uiText?: string }
	| { type: "THINKING"; thinking?: string }
	| { type: "MEDIA"; mediaInfo?: { fileName?: string } }
	| { type: "TOOL_CALL"; toolCall: RoomHistoryToolCall }
	| { type: "TOOL_RESULT"; toolResult: RoomHistoryToolResult }
	| {
			type: "SUBAGENT";
			subagent: {
				id: string;
				status: AgentRunStatusValue;
				alias?: string;
				resultPreview?: string;
				error?: string;
			};
	  };

/** One message as `GetPlaygroundMessages` returns it, reduced to what is read here. */
export interface RoomHistoryMessage {
	io: "INPUT" | "OUTPUT";
	messageId: string;
	parentMessageId?: string;
	summaryLeafMessageId?: string;
	/** Input only: `INPUT_TOOL_EXEC` carries tool results back, not a prompt. */
	type?: string;
	/** False for the platform's hidden turns, such as a room's kickoff message. */
	visible?: boolean;
	parts?: readonly RoomHistoryPart[];
}

type ToolStatus = Extract<AgentRunItem, { kind: "tool" }>["status"];

/**
 * What `toolResult.toolStatus` means, in the transcript's statuses, as the
 * harness's `ToolStore` reads it. A result without a status is a success:
 * server-run tools record one only when something went wrong. "paused" is
 * retired, and a room persisted before it was still shows it as cancelled.
 */
const RESULT_STATUS: Partial<Record<string, ToolStatus>> = {
	error: "FAILED",
	cancelled: "CANCELLED",
	paused: "CANCELLED",
};

/**
 * The branch the harness would show: from the root, the last child added at
 * every step, in the order the backend returned the messages (oldest first).
 */
const activeBranch = (
	messages: readonly RoomHistoryMessage[],
): RoomHistoryMessage[] => {
	const ids = new Set(messages.map((message) => message.messageId));
	const parentOf = (message: RoomHistoryMessage): string | undefined => {
		for (const id of [
			message.parentMessageId,
			message.summaryLeafMessageId,
		]) {
			if (id && ids.has(id)) {
				return id;
			}
		}
		return undefined;
	};

	let rootChild: RoomHistoryMessage | undefined;
	const lastChild = new Map<string, RoomHistoryMessage>();
	for (const message of messages) {
		const parent = parentOf(message);
		if (parent === undefined) {
			rootChild = message;
		} else {
			lastChild.set(parent, message);
		}
	}

	const branch: RoomHistoryMessage[] = [];
	// Each message has one parent, so the walk cannot revisit one - unless two
	// messages share an id, which links the chain back on itself. That would be
	// a corrupt room, but a console that hangs on opening one is worse.
	const seen = new Set<string>();
	for (
		let message = rootChild;
		message !== undefined && !seen.has(message.messageId);
		message = lastChild.get(message.messageId)
	) {
		seen.add(message.messageId);
		branch.push(message);
	}
	return branch;
};

const toolLine = (
	call: RoomHistoryToolCall,
	result: RoomHistoryToolResult | undefined,
	translate: Translate,
): Line => {
	const status: ToolStatus =
		result === undefined
			? "QUEUED"
			: (RESULT_STATUS[result.toolStatus ?? ""] ?? "COMPLETED");
	return lineForItem(
		{
			id: call.id,
			kind: "tool",
			// `toolLabel` tries the title and the recorded original name first;
			// the part's own `original_name` is the harness's next fallback.
			name: call.original_name || call.name,
			title: call.title,
			arguments: call.arguments ?? {},
			metadata: call._meta,
			status,
			output: status === "COMPLETED" ? result?.output : undefined,
			error: status === "FAILED" ? result?.output : undefined,
		},
		translate,
	);
};

const fileLine = (fileName: string | undefined): Line | undefined =>
	fileName ? textLine(fileName, "path") : undefined;

const unknownLine = (type: unknown, translate: Translate): Line =>
	textLine(
		translate("transcript.unknownItem", { kind: String(type) }),
		"dim",
	);

/** A prompt reads as typed: `uiText` when the platform kept one, else the text sent. */
const promptLines = (message: RoomHistoryMessage): Line[] => {
	const parts = message.parts ?? [];
	const lines: Line[] = [];
	const text = parts
		.flatMap((part) =>
			part.type === "TEXT" ? [part.uiText || part.text || ""] : [],
		)
		.filter((value) => value !== "")
		.join("\n");
	if (text !== "") {
		lines.push({ kind: "prompt", text });
	}
	for (const part of parts) {
		if (part.type === "MEDIA") {
			const line = fileLine(part.mediaInfo?.fileName);
			if (line) {
				lines.push(line);
			}
		}
	}
	return lines;
};

const responseLines = (
	message: RoomHistoryMessage,
	results: ReadonlyMap<string, RoomHistoryToolResult>,
	translate: Translate,
): Line[] => {
	const lines: Line[] = [];
	for (const [index, part] of (message.parts ?? []).entries()) {
		// Not read by the projection, but unique, as a live item's id is.
		const id = `${message.messageId}:${index}`;
		switch (part.type) {
			case "TEXT":
				if (part.text) {
					lines.push(
						lineForItem(
							{
								id,
								kind: "message",
								role: "assistant",
								text: part.text,
							},
							translate,
						),
					);
				}
				break;
			case "THINKING":
				if (part.thinking) {
					lines.push(
						lineForItem(
							{ id, kind: "reasoning", summary: part.thinking },
							translate,
						),
					);
				}
				break;
			case "MEDIA": {
				const line = fileLine(part.mediaInfo?.fileName);
				if (line) {
					lines.push(line);
				}
				break;
			}
			case "TOOL_CALL":
				lines.push(
					toolLine(
						part.toolCall,
						results.get(part.toolCall.id),
						translate,
					),
				);
				break;
			case "TOOL_RESULT":
				// Shown as its call's status, not as a line of its own.
				break;
			case "SUBAGENT":
				lines.push(
					lineForItem(
						{
							id: part.subagent.id,
							kind: "subagent",
							childRunId: part.subagent.id,
							alias: part.subagent.alias,
							// Not persisted, and not read by the projection.
							roomId: "",
							status: part.subagent.status,
							resultPreview: part.subagent.resultPreview,
							error: part.subagent.error,
						},
						translate,
					),
				);
				break;
			default:
				lines.push(
					unknownLine((part as { type?: unknown }).type, translate),
				);
		}
	}
	return lines;
};

/**
 * @param messages a room's messages, oldest first, as `GetPlaygroundMessages`
 *                 returns them
 * @return the lines of the branch the harness would show; empty for a new room
 */
export const roomHistoryLines = (
	messages: readonly RoomHistoryMessage[],
	translate: Translate = translateEnglish,
): Line[] => {
	const branch = activeBranch(messages);

	// A tool's result is in the next input message (INPUT_TOOL_EXEC), or in the
	// same response for a tool the provider ran itself. Hidden messages count:
	// the result is what the call did, whether or not its message is shown.
	const results = new Map<string, RoomHistoryToolResult>();
	for (const message of branch) {
		for (const part of message.parts ?? []) {
			if (part.type === "TOOL_RESULT") {
				results.set(part.toolResult.toolCallId, part.toolResult);
			}
		}
	}

	return branch.flatMap((message) => {
		if (message.visible === false) {
			return [];
		}
		if (message.io === "OUTPUT") {
			return responseLines(message, results, translate);
		}
		return message.type === "INPUT_TOOL_EXEC" ? [] : promptLines(message);
	});
};
