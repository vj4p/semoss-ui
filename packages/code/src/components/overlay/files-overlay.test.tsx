import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RoomFileEntry } from "@/api/room-files";
import { FilesOverlay } from "./files-overlay";
import { overlayI18n, renderOverlay } from "./render-overlay";

const browseRoomFolder = vi.fn();
vi.mock("@/api/room-data", () => ({
	browseRoomFolder: (...args: unknown[]) => browseRoomFolder(...args),
}));

const dir = (name: string, path: string): RoomFileEntry => ({
	name,
	path,
	isDirectory: true,
});
const file = (name: string, path: string): RoomFileEntry => ({
	name,
	path,
	isDirectory: false,
});

const TREE: Record<string, RoomFileEntry[]> = {
	".": [dir("src", "/src/"), file("README.md", "/README.md")],
	"/src": [dir("lib", "/src/lib/"), file("a.ts", "/src/a.ts")],
	"/src/lib": [file("deep.ts", "/src/lib/deep.ts")],
};

/** Open the overlay in a room's insight, or with `{ room: false }` before any room exists. */
const open = ({ room = true }: { room?: boolean } = {}) =>
	renderOverlay(
		<FilesOverlay
			open
			onDismiss={vi.fn()}
			insightId={room ? "insight-1" : undefined}
		/>,
	);

beforeAll(async () => {
	await overlayI18n.ready;
});

afterEach(() => {
	browseRoomFolder.mockReset();
});

describe("FilesOverlay", () => {
	it("says there is no room yet, and reads nothing", () => {
		open({ room: false });
		expect(screen.getByText("No room yet")).toBeTruthy();
		expect(browseRoomFolder).not.toHaveBeenCalled();
	});

	it("announces loading, then lists the top folder", async () => {
		browseRoomFolder.mockImplementation(
			async (_i: string, folder: string) => TREE[folder] ?? [],
		);
		open();
		expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
		expect(await screen.findByRole("button", { name: "src" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "README.md" })).toBeTruthy();
		expect(browseRoomFolder).toHaveBeenCalledWith("insight-1", ".");
	});

	it("lists a folder when it is opened, to any depth, and closes it again", async () => {
		browseRoomFolder.mockImplementation(
			async (_i: string, folder: string) => TREE[folder] ?? [],
		);
		open();
		const src = await screen.findByRole("button", { name: "src" });
		expect(src.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(src);
		fireEvent.click(await screen.findByRole("button", { name: "lib" }));
		expect(
			await screen.findByRole("button", { name: "deep.ts" }),
		).toBeTruthy();
		expect(browseRoomFolder).toHaveBeenCalledWith("insight-1", "/src/lib");
		fireEvent.click(screen.getByRole("button", { name: "src" }));
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "deep.ts" }),
			).toBeNull(),
		);
	});

	it("filters file names in the opened folders and offers to clear the filter", async () => {
		browseRoomFolder.mockImplementation(
			async (_i: string, folder: string) => TREE[folder] ?? [],
		);
		open();
		await screen.findByRole("button", { name: "README.md" });
		fireEvent.change(
			screen.getByRole("searchbox", { name: "Filter files" }),
			{
				target: { value: "zzz" },
			},
		);
		expect(screen.queryByRole("button", { name: "README.md" })).toBeNull();
		expect(screen.getByRole("button", { name: "src" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
		expect(
			await screen.findByRole("button", { name: "README.md" }),
		).toBeTruthy();
	});

	it("copies a file's path and says so", async () => {
		browseRoomFolder.mockResolvedValue(TREE["."]);
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		});
		open();
		fireEvent.click(
			await screen.findByRole("button", { name: "README.md" }),
		);
		expect(writeText).toHaveBeenCalledWith("/README.md");
		expect(await screen.findByText("Copied /README.md")).toBeTruthy();
	});

	it("says when a copy was refused", async () => {
		browseRoomFolder.mockResolvedValue(TREE["."]);
		Object.defineProperty(navigator, "clipboard", {
			value: {
				writeText: vi.fn().mockRejectedValue(new Error("denied")),
			},
			configurable: true,
		});
		open();
		fireEvent.click(
			await screen.findByRole("button", { name: "README.md" }),
		);
		expect(
			await screen.findByText("Could not copy /README.md"),
		).toBeTruthy();
	});

	it("shows a failed folder as an alert with its own retry, and recovers", async () => {
		browseRoomFolder
			.mockResolvedValueOnce(TREE["."])
			.mockRejectedValueOnce(new Error("Folder gone"))
			.mockResolvedValueOnce(TREE["/src"]);
		open();
		fireEvent.click(await screen.findByRole("button", { name: "src" }));
		const alert = await screen.findByRole("alert");
		expect(within(alert).getByText("Folder gone")).toBeTruthy();
		fireEvent.click(
			within(alert).getByRole("button", { name: "Try again" }),
		);
		expect(
			await screen.findByRole("button", { name: "a.ts" }),
		).toBeTruthy();
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("says an empty room has no files", async () => {
		browseRoomFolder.mockResolvedValue([]);
		open();
		expect(await screen.findByText("No files yet")).toBeTruthy();
	});
});
