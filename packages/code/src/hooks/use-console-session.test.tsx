import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionCatalog } from "@semoss/agent-core";
import { useConsoleSession } from "./use-console-session";

const navigate = vi.fn();
vi.mock("react-router", () => ({
	useNavigate: () => navigate,
}));

const createRoom = vi.fn();
vi.mock("@/api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/api")>();
	return {
		...actual,
		createRoom: (...args: unknown[]) => createRoom(...args),
	};
});

const CATALOG: SessionCatalog = {
	harnesses: [{ name: "claude_code", label: "Claude Code", isDefault: true }],
	models: [{ id: "model-1", name: "GPT-5" }],
};

const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

const mount = () =>
	renderHook(() =>
		useConsoleSession({
			catalog: CATALOG,
			translate: (text) => text,
		}),
	);

beforeEach(() => {
	navigate.mockReset();
	createRoom.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("useConsoleSession, for a session that starts with no room", () => {
	it("fills in openedRoom's insight once the first prompt creates one", async () => {
		createRoom.mockResolvedValue({
			roomId: "room-new",
			insightId: "insight-new",
		} satisfies { roomId: string; insightId: string });

		const { result } = mount();
		expect(result.current.status).toBe("ready");
		if (result.current.status !== "ready") throw new Error("unreachable");
		expect(result.current.openedRoom).toBeUndefined();

		// Mirrors what the real backend does on a room-creating submit: no
		// server here, so call the session API the same way a run start would.
		const ready = result.current;
		if (ready.status !== "ready") throw new Error("unreachable");
		await act(async () => {
			await ready.session.submit("Hello");
			await settle();
		});

		expect(createRoom).toHaveBeenCalled();
		// This is the regression: before the fix, openedRoom stayed
		// undefined for the rest of the session once it auto-created its
		// room, because the session's state update after that only mirrors
		// the room id (via onRoomChange) and never updated the insight the
		// backend's own createRoom learned asynchronously. The :mcp overlay
		// reads this prop, so a stuck undefined insightId meant Apply never
		// enabled for the entire first room of every fresh console session.
		expect(result.current.openedRoom).toEqual({
			roomId: "room-new",
			insightId: "insight-new",
		});
		expect(navigate).toHaveBeenCalledWith("/room/room-new", {
			replace: true,
		});
	});
});
