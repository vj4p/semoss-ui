import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Session } from "@semoss/agent-core";
import { HistorySearchOverlay } from "./history-search-overlay";
import { overlayI18n, renderOverlay } from "./render-overlay";

/** A session whose history is a prompt, then a command (the newest). */
const sessionWith = (entries: unknown[]): Session =>
	({ getState: () => ({ entries }) }) as unknown as Session;

const HISTORY = [
	{ kind: "run", prompt: "fix the login bug", startedAt: 1 },
	{ kind: "input", text: ":help" },
];

const mount = (entries: unknown[] = HISTORY) => {
	const onSelect = vi.fn();
	const onDismiss = vi.fn();
	renderOverlay(
		<HistorySearchOverlay
			open
			onDismiss={onDismiss}
			onSelect={onSelect}
			session={sessionWith(entries)}
		/>,
	);
	return { onSelect, onDismiss };
};

const scrollIntoView = vi.fn();

beforeAll(async () => {
	await overlayI18n.ready;
	// jsdom does not implement scrolling
	Element.prototype.scrollIntoView = scrollIntoView;
});

describe("HistorySearchOverlay", () => {
	it("lists the newest entry first and tells commands from prompts", () => {
		mount();

		const options = screen.getAllByRole("option");

		expect(options).toHaveLength(2);
		expect(options[0]).toHaveTextContent("cmd:help");
		expect(options[1]).toHaveTextContent("promptfix the login bug");
		expect(screen.getByRole("status")).toHaveTextContent("Items: 2");
	});

	it("is a combobox whose highlighted option follows the arrow keys", async () => {
		const { onSelect, onDismiss } = mount();
		const search = screen.getByRole("combobox", {
			name: "Search command and prompt history",
		});
		const [first, second] = screen.getAllByRole("option");
		expect(search).toHaveAttribute("aria-activedescendant", first.id);
		expect(first).toHaveAttribute("aria-selected", "true");

		fireEvent.keyDown(search, { key: "ArrowDown" });

		await waitFor(() =>
			expect(search).toHaveAttribute("aria-activedescendant", second.id),
		);
		expect(second).toHaveAttribute("aria-selected", "true");
		expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });

		fireEvent.keyDown(search, { key: "Enter" });

		expect(onSelect).toHaveBeenCalledWith("fix the login bug");
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("sets each entry's direction from its own text, so a command's colon stays in front in a right-to-left page", () => {
		mount();

		expect(screen.getByText(":help")).toHaveAttribute("dir", "auto");
	});

	it("chooses an entry that is clicked", () => {
		const { onSelect, onDismiss } = mount();

		fireEvent.click(screen.getAllByRole("option")[0]);

		expect(onSelect).toHaveBeenCalledWith(":help");
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("narrows the list as the person types, and says when nothing matches", () => {
		mount();
		const search = screen.getByRole("combobox");

		fireEvent.change(search, { target: { value: "login" } });
		expect(screen.getAllByRole("option")).toHaveLength(1);
		expect(screen.getByRole("status")).toHaveTextContent("Items: 1");

		fireEvent.change(search, { target: { value: "zzz" } });
		expect(screen.queryByRole("option")).not.toBeInTheDocument();
		expect(screen.getByText("No matching items")).toBeInTheDocument();
		expect(search).toHaveAttribute("aria-expanded", "false");
	});

	it("explains an empty history", () => {
		mount([]);

		expect(screen.getByText("History is empty")).toBeInTheDocument();
		expect(
			screen.getByText("Commands and prompts will appear here"),
		).toBeInTheDocument();
	});
});
