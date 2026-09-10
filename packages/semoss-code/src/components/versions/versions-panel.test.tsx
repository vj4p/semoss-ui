import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import "@testing-library/jest-dom";
import { VersionsPanel } from "./versions-panel";

const mockRunPixel = vi.fn();
vi.mock("@semoss/sdk", () => ({
	runPixel: (...args: unknown[]) => mockRunPixel(...args),
}));

test("lists commits and restores on click", async () => {
	mockRunPixel
		.mockResolvedValueOnce({
			errors: [],
			pixelReturn: [
				{
					output: [
						{
							commitId: "abc123",
							author: {
								userId: "vbhagwati",
								userEmail: "v@x.com",
							},
							date: "2026-09-10T12:00:00Z",
							commitMessage: "Initial commit",
							parentCommitIds: [],
							tags: [],
							refs: [],
						},
					],
				},
			],
		})
		.mockResolvedValueOnce({ errors: [], pixelReturn: [{ output: true }] });

	render(<VersionsPanel projectId="proj-1" />);

	await waitFor(() =>
		expect(screen.getByText("Initial commit")).toBeInTheDocument(),
	);

	fireEvent.click(screen.getByText("Restore"));

	await waitFor(() =>
		expect(mockRunPixel).toHaveBeenCalledWith(
			expect.stringContaining(
				'ProjectCommitRestore(project=["proj-1"], commitId=["abc123"])',
			),
		),
	);
});
