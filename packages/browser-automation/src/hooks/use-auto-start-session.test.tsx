// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RemoteBrowserSessionInfo } from "../types/browserEvents";
import {
	type AutoStartSession,
	type UseAutoStartSessionOptions,
	useAutoStartSession,
} from "./use-auto-start-session";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const info: RemoteBrowserSessionInfo = {
	sessionId: "session-1",
	webSocketUrl: "ws://localhost/session-1",
	viewport: { width: 1365, height: 768 },
	currentUrl: "https://example.com/start",
};

let root: Root;
let container: HTMLElement;
const latest: { handle: AutoStartSession | null } = { handle: null };

function Harness({ options }: { options: UseAutoStartSessionOptions }) {
	latest.handle = useAutoStartSession(options);
	return null;
}

function options(
	overrides: Partial<UseAutoStartSessionOptions> = {},
): UseAutoStartSessionOptions {
	return {
		isReady: true,
		hasSession: false,
		isCreating: false,
		isPlaygroundMode: true,
		startupUrl: "https://example.com/start",
		rearmKey: "execution-1",
		createSession: vi.fn(async () => info),
		onStarting: vi.fn(),
		onStarted: vi.fn(),
		...overrides,
	};
}

function render(opts: UseAutoStartSessionOptions) {
	act(() => {
		root.render(<Harness options={opts} />);
	});
}

/** A createSession that stays pending until the test settles it. */
function pendingSession() {
	let resolve: (value: RemoteBrowserSessionInfo | null) => void = () =>
		undefined;
	const promise = new Promise<RemoteBrowserSessionInfo | null>((res) => {
		resolve = res;
	});
	return { createSession: vi.fn(() => promise), resolve };
}

beforeEach(() => {
	container = document.createElement("div");
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	latest.handle = null;
});

describe("useAutoStartSession", () => {
	it("opens the session once the host is ready and reports it", async () => {
		const opts = options();
		render(opts);
		await act(async () => {});
		expect(opts.onStarting).toHaveBeenCalledWith(
			"https://example.com/start",
		);
		expect(opts.createSession).toHaveBeenCalledOnce();
		expect(opts.createSession).toHaveBeenCalledWith(
			"https://example.com/start",
			1365,
			768,
			false,
		);
		expect(opts.onStarted).toHaveBeenCalledWith(
			info,
			"https://example.com/start",
		);
	});

	it("opens a blank, existing-preserving session outside Playground", async () => {
		const opts = options({ isPlaygroundMode: false, startupUrl: "" });
		render(opts);
		await act(async () => {});
		expect(opts.createSession).toHaveBeenCalledWith("", 1365, 768, true);
	});

	it("waits until the host is ready, and in Playground until it knows the page", async () => {
		const opts = options({ isReady: false });
		render(opts);
		render({ ...opts, isReady: true, startupUrl: "" });
		await act(async () => {});
		expect(opts.createSession).not.toHaveBeenCalled();
		render({ ...opts, isReady: true, startupUrl: "https://example.com/a" });
		await act(async () => {});
		expect(opts.createSession).toHaveBeenCalledOnce();
	});

	it("does not open a second session while one is open or being opened", async () => {
		const withSession = options({ hasSession: true });
		render(withSession);
		render(
			options({
				isCreating: true,
				createSession: withSession.createSession,
			}),
		);
		await act(async () => {});
		expect(withSession.createSession).not.toHaveBeenCalled();
	});

	it("tries once only: a failed start stays spent across re-renders and isCreating changes", async () => {
		const createSession = vi.fn(async () => null);
		const opts = options({ createSession });
		render(opts);
		await act(async () => {});
		expect(createSession).toHaveBeenCalledOnce();
		expect(opts.onStarted).not.toHaveBeenCalled();

		// the host re-renders as isCreating goes true, then false again
		render({ ...opts, isCreating: true });
		render({ ...opts, isCreating: false });
		render({ ...opts, isCreating: false });
		await act(async () => {});
		expect(createSession).toHaveBeenCalledOnce();
	});

	it("stays spent after a success too, even if the session is later closed", async () => {
		const opts = options();
		render(opts);
		await act(async () => {});
		render({ ...opts, hasSession: true });
		render({ ...opts, hasSession: false });
		await act(async () => {});
		expect(opts.createSession).toHaveBeenCalledOnce();
	});

	it("allows one more automatic start for a new tool execution, but not for an empty key", async () => {
		const createSession = vi.fn(async () => null);
		const opts = options({ createSession });
		render(opts);
		await act(async () => {});
		render({ ...opts, rearmKey: "" });
		render({ ...opts, isCreating: true });
		render({ ...opts, isCreating: false });
		await act(async () => {});
		expect(createSession).toHaveBeenCalledOnce();

		render({ ...opts, rearmKey: "execution-2" });
		await act(async () => {});
		expect(createSession).toHaveBeenCalledTimes(2);
		// and that attempt is spent too
		render({ ...opts, rearmKey: "execution-2", isCreating: true });
		render({ ...opts, rearmKey: "execution-2", isCreating: false });
		await act(async () => {});
		expect(createSession).toHaveBeenCalledTimes(2);
	});

	it("counts an explicit start as the automatic one, so its failure is not retried by itself", async () => {
		const createSession = vi.fn(async () => null);
		const opts = options({ createSession, isReady: false });
		render(opts);
		act(() => latest.handle?.markStarted());
		render({ ...opts, isReady: true });
		await act(async () => {});
		expect(createSession).not.toHaveBeenCalled();
	});

	it("does not report a session that opened after the host unmounted", async () => {
		const pending = pendingSession();
		const opts = options({ createSession: pending.createSession });
		render(opts);
		expect(pending.createSession).toHaveBeenCalledOnce();
		act(() => root.unmount());
		await act(async () => {
			pending.resolve(info);
		});
		expect(opts.onStarted).not.toHaveBeenCalled();
		// afterEach unmounts again; give it a live root
		root = createRoot(container);
	});

	it("starts once and still reports the session under Strict Mode's extra effect run", async () => {
		const opts = options();
		act(() => {
			root.render(
				<StrictMode>
					<Harness options={opts} />
				</StrictMode>,
			);
		});
		await act(async () => {});
		expect(opts.createSession).toHaveBeenCalledOnce();
		expect(opts.onStarted).toHaveBeenCalledOnce();
	});
});
