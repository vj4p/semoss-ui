import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@semoss/shared";
import { CloneProjectDialog } from "./clone-project-dialog";

const runPixel = vi.fn();

vi.mock("@/hooks", () => ({
	useSession: (selector: (state: { runPixel: typeof runPixel }) => unknown) =>
		selector({ runPixel }),
}));

/** What the session returns for a pixel that worked, with the new project's id */
const created = (projectId: string) => ({
	errors: [],
	pixelReturn: [{ output: { project_id: projectId } }],
});

/** Open the dialog on an app (or another type), returning its onClose */
const renderDialog = (projectType: Project["project_type"] = "INSIGHT") => {
	const onClose = vi.fn();
	render(
		<CloneProjectDialog
			open
			project={{ project_id: "tpl-1", project_type: projectType }}
			onClose={onClose}
		/>,
	);
	return onClose;
};

/** Type a name and press Clone */
const cloneAs = (name: string) => {
	fireEvent.change(screen.getByLabelText("Name"), {
		target: { value: name },
	});
	fireEvent.click(screen.getByRole("button", { name: "Clone" }));
};

describe("CloneProjectDialog", () => {
	beforeEach(() => {
		runPixel.mockReset();
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe() {}
				unobserve() {}
				disconnect() {}
			},
		);
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it("asks for a name, and does not accept spaces as one", async () => {
		renderDialog();

		cloneAs("   ");

		expect(await screen.findByText("Name is required")).toBeInTheDocument();
		expect(runPixel).not.toHaveBeenCalled();
	});

	it("clones an app and closes with the new project's id", async () => {
		runPixel.mockResolvedValue(created("new-1"));
		const onClose = renderDialog();

		cloneAs("My copy");

		await waitFor(() => expect(onClose).toHaveBeenCalledWith("new-1"));
		expect(runPixel).toHaveBeenCalledWith(
			'CreateAppFromTemplate(project=["My copy"], projectTemplate=["tpl-1"], global=["false"]);',
		);
	});

	it("keeps a quote or backslash in the name inside the query", async () => {
		runPixel.mockResolvedValue(created("new-1"));
		renderDialog();

		cloneAs('a "q" \\ b');

		await waitFor(() => expect(runPixel).toHaveBeenCalled());
		expect(runPixel).toHaveBeenCalledWith(
			'CreateAppFromTemplate(project=["a \\"q\\" \\\\ b"], projectTemplate=["tpl-1"], global=["false"]);',
		);
	});

	it("clones a skill with its own call", async () => {
		runPixel.mockResolvedValue(created("skill-2"));
		const onClose = renderDialog("SKILL");

		cloneAs("Skill copy");

		await waitFor(() => expect(onClose).toHaveBeenCalledWith("skill-2"));
		expect(runPixel).toHaveBeenCalledWith(
			'CloneSkill(skillId=["tpl-1"], name=["Skill copy"]);',
		);
	});

	it("shows the server's reason in the dialog and keeps what was typed", async () => {
		runPixel.mockResolvedValue({
			errors: ["This project is not enabled as a template."],
			pixelReturn: [],
		});
		const onClose = renderDialog();

		cloneAs("My copy");

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"This project is not enabled as a template.",
		);
		expect(screen.getByLabelText("Name")).toHaveValue("My copy");
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Clone" })).toBeEnabled();
	});

	it("closes with the new project when only its description cannot be saved, so a retry cannot make a second clone", async () => {
		runPixel.mockResolvedValueOnce(created("new-1")).mockResolvedValueOnce({
			errors: ["No permission"],
			pixelReturn: [],
		});
		const onClose = renderDialog();
		fireEvent.change(screen.getByLabelText("Description"), {
			target: { value: "About it" },
		});

		cloneAs("My copy");

		await waitFor(() => expect(onClose).toHaveBeenCalledWith("new-1"));
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(runPixel).toHaveBeenCalledTimes(2);
	});
});
