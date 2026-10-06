/**
 * The built-in commands: what `:help`, `:harness`, `:model` and `:allowed`
 * print, and that the rest reach the session.
 *
 * They run through a real session, typed as a user types them, so what is
 * tested is what the console does with the line and not only what the spec
 * would do if called.
 *
 * The decision commands replace the session method they call with a spy; what
 * the session then does with a waiting call is tested in `session.spec.ts`.
 */

import { describe, expect, it, vi } from "vitest";
import type { AgentStore } from "@semoss/sdk";
import type { KeyBinding } from "../keymap/keymap";
import type { Line } from "../transcript/line";
import {
	createSession,
	type SessionCatalog,
	type SessionHost,
} from "./session";

const CATALOG: SessionCatalog = {
	harnesses: [
		{ name: "claude_code", label: "Claude Code" },
		{ name: "semoss", label: "SEMOSS", isDefault: true },
	],
	models: [
		{ id: "model-1", name: "GPT-5" },
		{ id: "model-2", name: "Qwen 3.5" },
	],
};

const setup = ({
	catalog = CATALOG,
	host,
}: {
	catalog?: SessionCatalog;
	host?: SessionHost;
} = {}) =>
	createSession({
		backend: {
			createRoom: vi.fn(async (): Promise<string> => "room-new"),
			updateRoom: vi.fn(async (): Promise<void> => undefined),
			startRun: vi.fn(async (): Promise<AgentStore> => {
				throw new Error("no runs in these tests");
			}),
		},
		catalog,
		host,
	});

const plain = (line: Line): string =>
	line.kind === "text"
		? line.segments.map((segment) => segment.text).join("")
		: line.kind === "divider"
			? (line.label ?? "")
			: "";

/** What the command printed: the lines of the last notice. */
const printed = async (
	session: ReturnType<typeof setup>,
	command: string,
): Promise<Line[]> => {
	expect(await session.submit(command)).toMatchObject({ kind: "ran" });
	const entry = session.getState().entries.at(-1);
	if (entry?.kind !== "notice") {
		throw new Error(`${command} printed nothing`);
	}
	return [...entry.lines];
};

/** The rows of the table that follows `title`, up to the next title or hint. */
const tableAfter = (lines: Line[], title: string): string[] => {
	const texts = lines.map(plain);
	const start = texts.indexOf(title) + 1;
	const rows: string[] = [];
	for (const text of texts.slice(start)) {
		if (!text.startsWith("  ")) {
			break;
		}
		rows.push(text);
	}
	return rows;
};

/** A table row as its two columns. */
const columns = (row: string) => row.trim().split(/ {2,}/);

describe(":help", () => {
	it("lists every command, with its arguments and aliases, in order", async () => {
		const rows = tableAfter(await printed(setup(), ":help"), "Commands");
		expect(rows.map(columns)).toEqual([
			[":help", "List commands and keys"],
			[":harness [name…]", "Show the harnesses, or switch to one"],
			[":model [name…]", "Show the models, or switch to one"],
			[":new", "Start a new room"],
			[":stop", "Stop the running agent"],
			[":clear", "Clear the screen (the room keeps its history)"],
			[":approve, :allow", "Allow the tool call that is waiting"],
			[":deny, :reject", "Reject the tool call that is waiting"],
			[
				":edit <json…>",
				"Change the waiting call's arguments, then approve it",
			],
			[
				":always",
				"Approve the waiting call, and stop asking about its tool",
			],
			[":allowed", "List the tools that run without asking"],
			[
				":revoke [tool…]",
				"Ask about a tool again, or every tool when none is named",
			],
			[":files", "Browse files"],
			[":diff", "Show git diff for current changes"],
			[":runs", "Browse run history"],
			[":packs", "List capability packs"],
			[":cost", "Show cost and usage breakdown"],
			[":inbox", "View notifications and messages"],
			[":settings, :config", "Configure room settings and preferences"],
			[":agent, :agents", "Select agent harness type"],
			[":mcp, :tools", "Manage MCP tools and integrations"],
		]);
	});

	it("lists :export only when the host can save one", async () => {
		const rows = tableAfter(
			await printed(setup({ host: { saveExport: vi.fn() } }), ":help"),
			"Commands",
		);
		expect(columns(rows.at(-1) ?? "")).toEqual([
			":export",
			"Save the last run's raw events as JSON",
		]);
	});

	it("says how to send a prompt that starts with a colon", async () => {
		const lines = await printed(setup(), ":help");
		const hint = lines.find(
			(line) =>
				plain(line) ===
				"To send a prompt that starts with a colon, type two colons.",
		);
		expect(hint).toMatchObject({ segments: [{ emphasis: "dim" }] });
	});

	it("lists each action's keys together, in the keymap's order", async () => {
		const rows = tableAfter(await printed(setup(), ":help"), "Keys");
		expect(rows.map(columns)).toEqual([
			["Enter", "Send the prompt"],
			["Shift+Enter", "New line"],
			["↑", "Previous prompt"],
			["↓", "Next prompt"],
			["Ctrl+C / Esc", "Stop the running agent"],
			["Ctrl+C", "Clear the input"],
			["Ctrl+L", "Clear the screen"],
			["Alt+H", "Next harness"],
			["A", "Approve the waiting tool call (prompt empty)"],
			["D", "Deny the waiting tool call (prompt empty)"],
			["E", "Edit the waiting call's arguments (prompt empty)"],
			[
				"Shift+A",
				"Approve it, and stop asking about its tool (prompt empty)",
			],
		]);
	});

	it("names the keys as the platform's keyboard prints them", async () => {
		const rows = tableAfter(
			await printed(setup({ host: { platform: "mac" } }), ":help"),
			"Keys",
		);
		expect(rows.map(columns)).toContainEqual(["Option+H", "Next harness"]);
	});

	it("lists the host's keys when it binds its own", async () => {
		const keymap: KeyBinding[] = [
			{
				chord: { key: "Enter", ctrl: true },
				action: "submit",
				describe: "key.submit",
			},
			{
				chord: { key: "Enter", meta: true },
				action: "submit",
				describe: "key.submit",
			},
		];
		const rows = tableAfter(
			await printed(
				setup({ host: { keymap, platform: "mac" } }),
				":help",
			),
			"Keys",
		);
		expect(rows.map(columns)).toEqual([
			["Ctrl+Enter / Cmd+Enter", "Send the prompt"],
		]);
	});

	it("lines up each table's second column, and marks the first as code", async () => {
		const lines = await printed(setup(), ":help");
		for (const title of ["Commands", "Keys"]) {
			const rows = tableAfter(lines, title);
			const starts = rows.map((row) =>
				row.indexOf(columns(row)[1] ?? ""),
			);
			expect(new Set(starts).size).toBe(1);
		}
		const row = lines.find((line) =>
			plain(line).trim().startsWith(":help"),
		);
		expect(row).toMatchObject({
			segments: [
				{ text: "  " },
				{ text: ":help", emphasis: "code" },
				{ text: " ".repeat(15) },
				{ text: "List commands and keys" },
			],
		});
	});
});

describe(":harness", () => {
	it("lists the harnesses and marks the one in use", async () => {
		const lines = await printed(setup(), ":harness");
		expect(lines.map(plain)).toEqual([
			"Harnesses",
			"  claude_code  Claude Code",
			"  semoss       SEMOSS  current",
			"Type :harness followed by a name to switch.",
		]);
		expect(lines[2]).toMatchObject({
			segments: [
				{ text: "  " },
				{ text: "semoss", emphasis: "code" },
				{ text: "       " },
				{ text: "SEMOSS" },
				{ text: "  current", emphasis: "accent" },
			],
		});
	});

	it("switches to the harness named, spaces and all", async () => {
		const session = setup();
		expect(await session.submit(":harness Claude Code")).toEqual({
			kind: "ran",
			name: "harness",
		});
		expect(session.getState().harness).toBe("claude_code");
	});

	it("says so when there are none", async () => {
		const lines = await printed(
			setup({ catalog: { ...CATALOG, harnesses: [] } }),
			":harness",
		);
		expect(lines).toEqual([
			{
				kind: "text",
				segments: [
					{
						text: "No agent harness is available.",
						emphasis: "error",
					},
				],
			},
		]);
	});
});

describe(":model", () => {
	it("lists the models with their ids and marks the one in use", async () => {
		const lines = await printed(setup(), ":model");
		expect(lines.map(plain)).toEqual([
			"Models",
			"  GPT-5     model-1  current",
			"  Qwen 3.5  model-2",
			"Type :model followed by a name or an id to switch.",
		]);
		expect(lines[2]).toMatchObject({
			segments: [
				{ text: "  " },
				{ text: "Qwen 3.5", emphasis: "code" },
				{ text: "  " },
				{ text: "model-2", emphasis: "dim" },
			],
		});
	});

	it("switches to the model named", async () => {
		const session = setup();
		await session.submit(":model qwen 3.5");
		expect(session.getState().modelId).toBe("model-2");
	});

	it("says so when there are none", async () => {
		const lines = await printed(
			setup({ catalog: { ...CATALOG, models: [] } }),
			":model",
		);
		expect(lines.map(plain)).toEqual([
			"No model is available. A model appears here once it is tagged text-generation.",
		]);
	});
});

describe("the other commands", () => {
	it(":clear clears its own echo too, as a terminal's clear does", async () => {
		const session = setup();
		await session.submit(":help");
		expect(await session.submit(":clear")).toEqual({
			kind: "ran",
			name: "clear",
		});
		expect(session.getState().entries).toEqual([]);
	});

	it(":new leaves the room", async () => {
		const onRoomChange = vi.fn();
		const session = createSession({
			backend: {
				createRoom: vi.fn(async (): Promise<string> => "room-new"),
				updateRoom: vi.fn(async (): Promise<void> => undefined),
				startRun: vi.fn(async (): Promise<AgentStore> => {
					throw new Error("no runs in these tests");
				}),
			},
			catalog: CATALOG,
			roomId: "room-1",
			host: { onRoomChange },
		});
		await session.submit(":new");
		expect(session.getState().roomId).toBeUndefined();
		expect(onRoomChange).toHaveBeenCalledWith(undefined);
	});

	it("refuse arguments they do not take", async () => {
		const session = setup();
		for (const command of [
			":stop now",
			":help me",
			":approve all",
			":always now",
			":allowed x",
		]) {
			const [name] = command.split(" ");
			expect(await session.submit(command)).toEqual({
				kind: "error",
				message: `Usage: ${name}`,
			});
		}
	});
});

describe("the decision commands", () => {
	it(":edit hands the session its JSON as typed, newlines and all", async () => {
		const session = setup();
		const edit = vi.spyOn(session, "edit").mockResolvedValue(true);
		const json = '{\n\t"command": "pwd",\n\t"cwd": "/tmp"\n}';
		expect(await session.submit(`:edit ${json}`)).toEqual({
			kind: "ran",
			name: "edit",
		});
		expect(edit).toHaveBeenCalledWith(json);
	});

	it(":edit alone is refused, and sends nothing", async () => {
		const session = setup();
		const edit = vi.spyOn(session, "edit");
		expect(await session.submit(":edit")).toEqual({
			kind: "error",
			message: "Usage: :edit <json…>",
		});
		expect(edit).not.toHaveBeenCalled();
	});

	it(":always always allows the waiting call", async () => {
		const session = setup();
		const alwaysAllow = vi
			.spyOn(session, "alwaysAllow")
			.mockResolvedValue(true);
		expect(await session.submit(":always")).toEqual({
			kind: "ran",
			name: "always",
		});
		expect(alwaysAllow).toHaveBeenCalledWith();
	});

	it(":revoke hands the session the name as typed, or nothing for every tool", async () => {
		const session = setup();
		const revoke = vi.spyOn(session, "revoke").mockReturnValue(true);
		await session.submit(":revoke Run a command");
		await session.submit(":revoke");
		expect(revoke.mock.calls).toEqual([["Run a command"], [""]]);
	});

	it(":allowed says so when no tool runs without asking", async () => {
		expect(await printed(setup(), ":allowed")).toEqual([
			{
				kind: "text",
				segments: [
					{ text: "No tool runs without asking.", emphasis: "dim" },
				],
			},
		]);
	});
});
