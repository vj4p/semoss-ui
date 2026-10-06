import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { codeResources, I18nBuilder, I18nextProvider } from "@semoss/i18n";
import { getAgentHarnesses } from "@semoss/sdk";
import { useAgentHarnesses } from "@semoss/shared";

vi.mock("@semoss/sdk", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@semoss/sdk")>();
	return { ...actual, getAgentHarnesses: vi.fn() };
});

const harnesses = vi.mocked(getAgentHarnesses);

// The real resource config SEMOSS Code boots with -- deliberately omits the
// "room" namespace (see resources/code.ts), which is exactly the condition
// that reproduces the bug: a host that never loads "room" at all, as opposed
// to one that loads it but is missing one key.
const builder = new I18nBuilder(codeResources, { lockToEnglish: true });

const mount = () =>
	renderHook(() => useAgentHarnesses({ fallback: [] }), {
		wrapper: ({ children }) => (
			<I18nextProvider i18n={builder.i18n}>{children}</I18nextProvider>
		),
	});

beforeAll(async () => {
	await builder.ready;
});

afterEach(() => {
	harnesses.mockReset();
});

describe("useAgentHarnesses, in a host that never loads the room namespace", () => {
	it("falls back to the backend's displayName instead of leaking the i18n key", async () => {
		harnesses.mockResolvedValue([
			{
				name: "semoss",
				displayName: "SEMOSS",
				description: "Runs on the platform itself.",
				toolSource: "PLATFORM",
				supportsMediaInput: false,
				isDefault: true,
			},
		]);

		const { result } = mount();
		await waitFor(() => expect(result.current.loading).toBe(false));

		// Before the fix, a namespace i18next never loaded at all returns the
		// key with its "room:" prefix stripped ("harness.types.semoss.label")
		// rather than the full original key -- the old `value === key` check
		// only caught the latter, so this literal string leaked straight into
		// the status bar and the :harness/:model overlays.
		expect(result.current.harnesses).toEqual([
			{
				name: "semoss",
				label: "SEMOSS",
				description: "Runs on the platform itself.",
				isDefault: true,
			},
		]);
	});
});
