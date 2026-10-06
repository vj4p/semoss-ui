import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Session } from "@semoss/agent-core";
import { codeResources, I18nBuilder, I18nextProvider } from "@semoss/i18n";
import { MCPOverlay } from "./mcp-overlay";

vi.mock("@semoss/shared", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@semoss/shared")>();
	return {
		...actual,
		// The real selector queries MyEngines/MyProjects; this overlay's own
		// logic -- not the selector's -- is what's under test here.
		MCPSelector: ({ type }: { type: string }) => (
			<div data-testid={`selector-${type}`} />
		),
	};
});

const getRoomOptions = vi.fn();
const updateRoomOptions = vi.fn();
vi.mock("@/api", () => ({
	getRoomOptions: (...args: unknown[]) => getRoomOptions(...args),
	updateRoomOptions: (...args: unknown[]) => updateRoomOptions(...args),
}));

const builder = new I18nBuilder(codeResources, { lockToEnglish: true });

const fakeSession = (roomId?: string) =>
	({
		getState: vi.fn(() => ({ roomId }) as ReturnType<Session["getState"]>),
	}) as unknown as Session;

const mount = (props: {
	insightId?: string;
	roomId?: string;
	onDismiss?: () => void;
}) => {
	const onDismiss = props.onDismiss ?? vi.fn();
	const session = fakeSession(props.roomId);
	// The real host (console-loader) keeps every overlay mounted and only
	// toggles `open`; the component's load effect fires on that closed->open
	// transition, not on an initial mount already open. Match that shape.
	const { rerender } = render(
		<I18nextProvider i18n={builder.i18n}>
			<MCPOverlay
				open={false}
				onDismiss={onDismiss}
				session={session}
				insightId={props.insightId}
				roomId={props.roomId}
			/>
		</I18nextProvider>,
	);
	rerender(
		<I18nextProvider i18n={builder.i18n}>
			<MCPOverlay
				open
				onDismiss={onDismiss}
				session={session}
				insightId={props.insightId}
				roomId={props.roomId}
			/>
		</I18nextProvider>,
	);
	return { onDismiss };
};

beforeAll(async () => {
	await builder.ready;
});

afterEach(() => {
	getRoomOptions.mockReset();
	updateRoomOptions.mockReset();
});

describe("MCPOverlay, before a room exists", () => {
	it("disables Apply and explains why, instead of silently discarding the selection", async () => {
		mount({ insightId: undefined, roomId: undefined });

		await waitFor(() =>
			expect(screen.getByTestId("selector-TOOLBOX")).toBeInTheDocument(),
		);

		expect(
			screen.getByText(
				"Send a message first to create this room, then reopen :mcp to attach tools to it.",
			),
		).toBeVisible();
		expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();

		// A pre-fix stale click used to warn to the console and dismiss as if
		// the (nonexistent) selection had been saved. Confirm it now does
		// nothing silently discoverable only in devtools: no API call, no
		// pretending the save worked.
		fireEvent.click(screen.getByRole("button", { name: "Apply" }));
		expect(updateRoomOptions).not.toHaveBeenCalled();
	});
});

describe("MCPOverlay, once a room exists", () => {
	it("enables Apply and saves the selection", async () => {
		getRoomOptions.mockResolvedValue({ mcp: [] });
		updateRoomOptions.mockResolvedValue(undefined);
		const { onDismiss } = mount({
			insightId: "insight-1",
			roomId: "room-1",
		});

		await waitFor(() =>
			expect(getRoomOptions).toHaveBeenCalledWith("insight-1", "room-1"),
		);
		expect(
			screen.queryByText(
				"Send a message first to create this room, then reopen :mcp to attach tools to it.",
			),
		).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();

		fireEvent.click(screen.getByRole("button", { name: "Apply" }));

		await waitFor(() => expect(onDismiss).toHaveBeenCalled());
		expect(updateRoomOptions).toHaveBeenCalledWith("insight-1", "room-1", {
			mcp: [],
		});
	});
});
