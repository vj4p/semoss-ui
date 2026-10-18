import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
	STATUS_LABELS,
	STATUS_TEXT_CLASS,
	StatusBadge,
	type StatusKind,
	statusKindFromBackend,
} from "./status-badge";

afterEach(cleanup);

describe("statusKindFromBackend", () => {
	it.each([
		["QUEUED", "queued"],
		["SUBMITTED", "queued"],
		["INITIAL", "queued"],
		["RUNNING", "running"],
		["STARTING", "running"],
		["LOADING", "running"],
		["INPUT_REQUIRED", "waiting"],
		["WAITING", "waiting"],
		["COMPLETED", "done"],
		["SUCCESS", "done"],
		["FAILED", "failed"],
		["ERROR", "failed"],
		["REJECTED", "denied"],
		["CANCELLED", "cancelled"],
	] as const)("%s is %s", (value, kind) => {
		expect(statusKindFromBackend(value)).toBe(kind);
	});

	it("ignores case and surrounding space", () => {
		expect(statusKindFromBackend(" input_required ")).toBe("waiting");
	});

	it("returns undefined for an unknown or missing value", () => {
		expect(statusKindFromBackend("SOMETHING_NEW")).toBeUndefined();
		expect(statusKindFromBackend(undefined)).toBeUndefined();
		expect(statusKindFromBackend(null)).toBeUndefined();
	});
});

describe("StatusBadge", () => {
	it("shows the English word for each status by default", () => {
		const kinds = Object.keys(STATUS_LABELS) as StatusKind[];
		for (const kind of kinds) {
			const { unmount } = render(<StatusBadge status={kind} />);
			expect(screen.getByText(STATUS_LABELS[kind])).toBeTruthy();
			unmount();
		}
	});

	it("uses the label it is given", () => {
		render(<StatusBadge status="waiting" label="Needs approval" />);
		expect(screen.getByText("Needs approval")).toBeTruthy();
		expect(screen.queryByText("Waiting on you")).toBeNull();
	});

	it("hides its dot from assistive technology", () => {
		const { container } = render(<StatusBadge status="done" />);
		expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
	});

	it("exposes the status for styling and tests", () => {
		const { container } = render(<StatusBadge status="failed" />);
		expect(
			container.querySelector("[data-status='failed']"),
		).not.toBeNull();
	});
});

describe("STATUS_TEXT_CLASS", () => {
	it("uses only semantic tokens", () => {
		for (const cls of Object.values(STATUS_TEXT_CLASS)) {
			expect(cls).toMatch(
				/^text-(muted-foreground|primary-text|warning|success|destructive)/,
			);
		}
	});
});
