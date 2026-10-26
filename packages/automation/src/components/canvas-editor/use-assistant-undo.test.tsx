// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type AssistantUndoOptions,
	useAssistantUndo,
} from "./use-assistant-undo";

type Canvas = { name: string };
type Api = ReturnType<typeof useAssistantUndo<Canvas>>;

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;
const latest: { api: Api | null } = { api: null };

function Harness({ options }: { options: AssistantUndoOptions<Canvas> }) {
	latest.api = useAssistantUndo<Canvas>(options);
	return null;
}

const api = (): Api => {
	if (!latest.api) throw new Error("hook not rendered");
	return latest.api;
};

function options(
	overrides: Partial<AssistantUndoOptions<Canvas>> = {},
): AssistantUndoOptions<Canvas> {
	return {
		appId: "app-1",
		isDirty: false,
		getCanvas: () => ({ name: "before" }),
		restore: vi.fn(async () => undefined),
		reload: vi.fn(),
		...overrides,
	};
}

function render(opts: AssistantUndoOptions<Canvas>) {
	act(() => {
		root.render(<Harness options={opts} />);
	});
}

beforeEach(() => {
	container = document.createElement("div");
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	latest.api = null;
});

describe("useAssistantUndo", () => {
	it("offers nothing until an assistant edit has been loaded", () => {
		render(options());
		act(() => api().noteLoaded("rev-2"));
		expect(api().available).toBe(false);
	});

	it("keeps the canvas from before the edit, saves it against the new revision, then reloads", async () => {
		const opts = options();
		render(opts);
		act(() => {
			api().noteAssistantEdit();
			api().noteLoaded("rev-2");
		});
		expect(api().available).toBe(true);

		let result: Awaited<ReturnType<Api["undo"]>> | undefined;
		await act(async () => {
			result = await api().undo();
		});

		expect(result).toEqual({ ok: true });
		expect(opts.restore).toHaveBeenCalledWith({ name: "before" }, "rev-2");
		expect(opts.reload).toHaveBeenCalledOnce();
		expect(api().available).toBe(false);
	});

	it("returns to the first copy of a run of edits, guarded by the latest revision", async () => {
		let current = "before";
		const opts = options({ getCanvas: () => ({ name: current }) });
		render(opts);
		act(() => {
			api().noteAssistantEdit();
			api().noteLoaded("rev-2");
		});
		// the canvas now shows the first edit; a second edit follows
		current = "after first edit";
		act(() => {
			api().noteAssistantEdit();
			api().noteLoaded("rev-3");
		});
		await act(async () => {
			await api().undo();
		});
		expect(opts.restore).toHaveBeenCalledWith({ name: "before" }, "rev-3");
	});

	it("does not offer the copy again when the save is refused", async () => {
		const refusal = new Error("Automation changed since it was loaded");
		const opts = options({
			restore: vi.fn(async () => {
				throw refusal;
			}),
		});
		render(opts);
		act(() => {
			api().noteAssistantEdit();
			api().noteLoaded("rev-2");
		});
		let result: Awaited<ReturnType<Api["undo"]>> | undefined;
		await act(async () => {
			result = await api().undo();
		});
		expect(result).toEqual({ ok: false, error: refusal });
		expect(opts.reload).not.toHaveBeenCalled();
		expect(api().available).toBe(false);
	});

	it("clears when the person edits by hand", () => {
		render(options());
		act(() => {
			api().noteAssistantEdit();
			api().noteLoaded("rev-2");
		});
		expect(api().available).toBe(true);
		render(options({ isDirty: true }));
		expect(api().available).toBe(false);
	});

	it("clears when another automation opens", () => {
		render(options());
		act(() => {
			api().noteAssistantEdit();
			api().noteLoaded("rev-2");
		});
		render(options({ appId: "app-2" }));
		expect(api().available).toBe(false);
	});

	it("keeps the same functions between renders, so effects that use them do not loop", () => {
		render(options());
		const first = api();
		render(options());
		const second = api();
		expect(second.noteAssistantEdit).toBe(first.noteAssistantEdit);
		expect(second.noteLoaded).toBe(first.noteLoaded);
		expect(second.clear).toBe(first.clear);
		expect(second.undo).toBe(first.undo);
	});
});
