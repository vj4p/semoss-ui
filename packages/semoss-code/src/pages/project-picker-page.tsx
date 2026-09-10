import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { runPixel } from "@semoss/sdk";
import { Button, Card, Input, Spinner } from "@semoss/ui/next";

interface CodeProject {
	project_id: string;
	project_name: string;
	project_date_last_edited: string;
}

export const ProjectPickerPage = () => {
	const navigate = useNavigate();
	const [projects, setProjects] = useState<CodeProject[]>([]);
	const [status, setStatus] = useState<"LOADING" | "SUCCESS" | "ERROR">(
		"LOADING",
	);
	const [newProjectName, setNewProjectName] = useState("");
	const [isCreating, setIsCreating] = useState(false);

	const loadProjects = async () => {
		setStatus("LOADING");
		try {
			const response = await runPixel<[CodeProject[]]>(
				`MyProjects(projectType=["CODE"]);`,
			);
			if (response.errors.length > 0)
				throw new Error(response.errors.join(","));
			setProjects(response.pixelReturn[0].output);
			setStatus("SUCCESS");
		} catch (e) {
			console.error(e);
			setStatus("ERROR");
		}
	};

	useEffect(() => {
		void loadProjects();
	}, []);

	const createProject = async () => {
		if (!newProjectName.trim()) return;
		setIsCreating(true);
		try {
			const response = await runPixel<[CodeProject]>(
				`CreateProject(project=${JSON.stringify([newProjectName.trim()])}, projectType=["CODE"]);`,
			);
			if (response.errors.length > 0)
				throw new Error(response.errors.join(","));
			const projectId = response.pixelReturn[0].output.project_id;
			navigate(`/project/${projectId}`);
		} catch (e) {
			console.error(e);
			setIsCreating(false);
		}
	};

	return (
		<div className="mx-auto flex h-full max-w-2xl flex-col gap-6 overflow-auto p-8">
			<h1 className="font-semibold text-2xl">Semoss Code</h1>

			<div className="flex gap-2">
				<Input
					placeholder="New project name"
					value={newProjectName}
					onChange={(e) => setNewProjectName(e.target.value)}
					disabled={isCreating}
				/>
				<Button
					onClick={() => void createProject()}
					disabled={isCreating || !newProjectName.trim()}
				>
					{isCreating ? <Spinner /> : "Create"}
				</Button>
			</div>

			<div className="flex flex-col gap-2">
				<h2 className="font-medium text-muted-foreground text-sm">
					Your projects
				</h2>
				{status === "LOADING" && <Spinner />}
				{status === "ERROR" && (
					<p className="text-destructive">Failed to load projects.</p>
				)}
				{status === "SUCCESS" && projects.length === 0 && (
					<p className="text-muted-foreground">
						No code projects yet — create one above.
					</p>
				)}
				{status === "SUCCESS" &&
					projects.map((project) => (
						<Card
							key={project.project_id}
							className="cursor-pointer p-4 hover:bg-accent"
							onClick={() =>
								navigate(`/project/${project.project_id}`)
							}
						>
							<div className="font-medium">
								{project.project_name}
							</div>
							<div className="text-muted-foreground text-xs">
								Last edited{" "}
								{new Date(
									project.project_date_last_edited,
								).toLocaleString()}
							</div>
						</Card>
					))}
			</div>
		</div>
	);
};
