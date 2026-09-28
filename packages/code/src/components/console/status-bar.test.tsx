import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AllowedTool, Session, SessionState } from "@semoss/agent-core";
import { codeResources, I18nBuilder } from "@semoss/i18n";
import { StatusBar } from "./status-bar";

const builder = new I18nBuilder(codeResources, { lockToEnglish: true });

const state = (alwaysAllowed: AllowedTool[]): SessionState => ({
	catalog: { harnesses: [], models: [] },
	entries: [],
	alwaysAllowed,
});

const session = {
	setHarness: vi.fn<Session["setHarness"]>(async () => true),
	setModel: vi.fn<Session["setModel"]>(async () => true),
} satisfies Partial<Session> as unknown as Session;

beforeAll(async () => {
	await builder.ready;
});

describe("StatusBar", () => {
	it("lists the tools that run without asking", () => {
		render(
			<StatusBar
				state={state([
					{ toolName: "Bash", label: "Bash" },
					{ toolName: "a1b2_search", label: "search" },
				])}
				session={session}
			/>,
		);

		const list = screen.getByRole("list", { name: "Always allowed" });
		expect(
			within(list)
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["Bash", "search"]);
	});

	it("leaves the list out while every tool asks", () => {
		render(<StatusBar state={state([])} session={session} />);

		expect(
			screen.queryByTestId("statusBar-alwaysAllowed-list"),
		).not.toBeInTheDocument();
		expect(screen.queryByText("Always allowed")).not.toBeInTheDocument();
	});
});
