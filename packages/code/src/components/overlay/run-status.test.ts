import { describe, expect, it } from "vitest";
import { describeRunStatus } from "./run-status";

describe("describeRunStatus", () => {
	it.each([
		["COMPLETED", "Done", "text-success"],
		["FAILED", "Failed", "text-destructive"],
		["CANCELLED", "Cancelled", "text-muted-foreground"],
		["REJECTED", "Denied", "text-muted-foreground"],
		["RUNNING", "Running", "text-primary-text"],
		["STARTING", "Running", "text-primary-text"],
		["INPUT_REQUIRED", "Waiting on you", "text-warning"],
		["QUEUED", "Queued", "text-muted-foreground"],
		["SUBMITTED", "Queued", "text-muted-foreground"],
		["LOST", "Lost contact", "text-warning"],
	])("%s reads as %s", (raw, label, className) => {
		expect(describeRunStatus(raw)).toEqual({ label, className });
	});

	it("is case-insensitive", () => {
		expect(describeRunStatus("input_required").label).toBe(
			"Waiting on you",
		);
	});

	it("never reports an unknown state as done", () => {
		const unknown = describeRunStatus("SOMETHING_NEW");
		expect(unknown.label).toBe("something_new");
		expect(unknown.className).toBe("text-muted-foreground");
	});
});
