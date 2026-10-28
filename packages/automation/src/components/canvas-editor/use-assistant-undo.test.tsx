// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type AssistantUndo,
	type AssistantUndoOptions,
	type AssistantUndoResult,
	useAssistantUndo,
} from "./use-assistant-undo";

type Canvas = { name: string };
type Api = AssistantUndo;

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

/** A restore that stays pending until the test settles it. */
function deferredRestore() {
	let resolve: () => void = () => undefined;
	let reject: (reason: unknown) => void = () => undefined;
	const promise = new Promise<void>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { restore: vi.fn(() => promise), resolve, reject };
}

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

		let result: AssistantUndoResult | undefined;
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
		let result: AssistantUndoResult | undefined;
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

	it("reads the latest options after a re-render, so the first pre-edit canvas is the one restored", async () => {
		const opts = options({ getCanvas: () => ({ name: "stale getter" }) });
		render(opts);
		// a later render brings a new getter; the stable callbacks must use it
		const latestOpts = { ...opts, getCanvas: () => ({ name: "before" }) };
		render(latestOpts);
		act(() => {
			api().noteAssistantEdit();
			api().noteLoaded("rev-2");
		});
		await act(async () => {
			await api().undo();
		});
		expect(opts.restore).toHaveBeenCalledWith({ name: "before" }, "rev-2");
	});

	it("reports a rejection that is not an Error and offers nothing again", async () => {
		const opts = options({
			restore: vi.fn(async () => {
				throw "plain string failure";
			}),
		});
		render(opts);
		act(() => {
			api().noteAssistantEdit();
			api().noteLoaded("rev-2");
		});
		let result: AssistantUndoResult | undefined;
		await act(async () => {
			result = await api().undo();
		});
		expect(result).toEqual({ ok: false, error: "plain string failure" });
		expect(api().available).toBe(false);
		expect(api().undoing).toBe(false);
	});

	it("does not reload or clear when another automation opens while the undo is saving", async () => {
		const pending = deferredRestore();
		const opts = options({ restore: pending.restore });
		render(opts);
		act(() => {
			api().noteAssistantEdit();
			api().noteLoaded("rev-2");
		});
		let result: AssistantUndoResult | undefined;
		let undoPromise: Promise<AssistantUndoResult> = Promise.resolve({
			ok: true,
		});
		act(() => {
			undoPromise = api().undo();
		});
		expect(api().undoing).toBe(true);

		// the other automation opens and gets an undo point of its own
		const second = options({ appId: "app-2", reload: opts.reload });
		render(second);
		expect(api().undoing).toBe(false);
		act(() => {
			api().noteAssistantEdit();
			api().noteLoaded("rev-9");
		});
		expect(api().available).toBe(true);

		await act(async () => {
			pending.resolve();
			result = await undoPromise;
		});
		expect(result).toMatchObject({ ok: false, superseded: true });
		expect(opts.reload).not.toHaveBeenCalled();
		// the other automation keeps the undo point it earned
		expect(api().available).toBe(true);
		expect(api().undoing).toBe(false);
	});

	it("stays quiet when the save is refused after another automation opened", async () => {
		const pending = deferredRestore();
		const opts = options({ restore: pending.restore });
		render(opts);
		act(() => {
			api().noteAssistantEdit();
			api().noteLoaded("rev-2");
		});
		let undoPromise: Promise<AssistantUndoResult> = Promise.resolve({
			ok: true,
		});
		act(() => {
			undoPromise = api().undo();
		});
		render(options({ appId: "app-2" }));
		act(() => {
			api().noteAssistantEdit();
			api().noteLoaded("rev-9");
		});
		let result: AssistantUndoResult | undefined;
		await act(async () => {
			pending.reject(new Error("refused"));
			result = await undoPromise;
		});
		expect(result).toMatchObject({ ok: false, superseded: true });
		expect(api().available).toBe(true);
	});

	it("does not reload or touch state when the consumer unmounts while the undo is saving", async () => {
		const pending = deferredRestore();
		const opts = options({ restore: pending.restore });
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		render(opts);
		act(() => {
			api().noteAssistantEdit();
			api().noteLoaded("rev-2");
		});
		let undoPromise: Promise<AssistantUndoResult> = Promise.resolve({
			ok: true,
		});
		act(() => {
			undoPromise = api().undo();
		});
		act(() => root.unmount());
		let result: AssistantUndoResult | undefined;
		await act(async () => {
			pending.resolve();
			result = await undoPromise;
		});
		expect(result).toMatchObject({ ok: false, superseded: true });
		expect(opts.reload).not.toHaveBeenCalled();
		expect(errors).not.toHaveBeenCalled();
		errors.mockRestore();
		// afterEach unmounts again; give it a live root
		root = createRoot(container);
	});
});
