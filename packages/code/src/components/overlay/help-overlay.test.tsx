import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { KeyBinding, Session } from "@semoss/agent-core";
import { HelpOverlay } from "./help-overlay";
import { overlayI18n, renderOverlay } from "./render-overlay";

/** The few parts of a session the help overlay reads. */
const fakeSession = (): Session =>
	({
		translate: (text: string) => text,
		commands: {
			commands: [
				{ name: "help", describe: "Show this help" },
				{ name: "stop", describe: "Stop the current run" },
				{
					name: "model",
					describe: "Pick a model",
					args: [{ name: "id", optional: true }],
				},
			],
		},
	}) as unknown as Session;

const keymap = [
	{
		chord: { key: "r", ctrl: true },
		action: "history",
		describe: "Search history",
	},
] as unknown as readonly KeyBinding[];

const mount = () =>
	renderOverlay(
		<HelpOverlay
			open
			onDismiss={vi.fn()}
			session={fakeSession()}
			keymap={keymap}
			platform="other"
		/>,
	);

beforeAll(async () => {
	await overlayI18n.ready;
});

describe("HelpOverlay", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("groups the commands under translated headings and lists the shortcuts", () => {
		mount();

		expect(
			screen.getByRole("heading", { name: "Commands" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Information" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Control" }),
		).toBeInTheDocument();
		expect(screen.getByText(":model [id]")).toBeInTheDocument();
		expect(screen.getByText("Ctrl+R")).toBeInTheDocument();
		expect(screen.getByText("Search history")).toBeInTheDocument();
	});

	it("keeps command usage and key names left-to-right", () => {
		mount();

		expect(screen.getByText(":stop")).toHaveAttribute("dir", "ltr");
		expect(screen.getByText("Ctrl+R")).toHaveAttribute("dir", "ltr");
	});

	it("names the search field and announces how many entries match", () => {
		mount();
		const search = screen.getByRole("searchbox", {
			name: "Search commands and shortcuts",
		});

		fireEvent.change(search, { target: { value: "stop" } });

		expect(
			screen.getByText("Commands: 1 · Shortcuts: 0"),
		).toBeInTheDocument();
		expect(screen.queryByText(":model [id]")).not.toBeInTheDocument();
	});

	it("matches a command by its group's name", () => {
		mount();

		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "contr" },
		});

		expect(screen.getByText(":stop")).toBeInTheDocument();
		expect(screen.queryByText(":help")).not.toBeInTheDocument();
	});

	it("says so when nothing matches", () => {
		mount();

		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "zzz" },
		});

		expect(screen.getByRole("status")).toHaveTextContent(
			'Nothing matches "zzz"',
		);
	});
});
