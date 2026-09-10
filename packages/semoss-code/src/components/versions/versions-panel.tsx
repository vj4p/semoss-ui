import { useEffect, useState } from "react";
import { runPixel } from "@semoss/sdk";
import { Button } from "@semoss/ui/next";

interface Commit {
	commitId: string;
	author: { userId: string; userEmail: string };
	date: string;
	commitMessage: string;
	parentCommitIds: string[];
	tags: string[];
	refs: { name: string; type: string }[];
}

interface VersionsPanelProps {
	projectId: string;
}

export const VersionsPanel = ({ projectId }: VersionsPanelProps) => {
	const [commits, setCommits] = useState<Commit[]>([]);
	const [restoringId, setRestoringId] = useState<string | null>(null);

	const loadCommits = async () => {
		const response = await runPixel<[Commit[]]>(
			`ProjectCommitDetails(project=["${projectId}"], limit=[50], offset=[0]);`,
		);
		if (response.errors.length > 0) {
			console.error(response.errors.join(","));
			return;
		}
		setCommits(response.pixelReturn[0].output);
	};

	useEffect(() => {
		void loadCommits();
	}, [projectId]);

	const restore = async (commitId: string) => {
		setRestoringId(commitId);
		try {
			const response = await runPixel<[boolean]>(
				`ProjectCommitRestore(project=["${projectId}"], commitId=["${commitId}"]);`,
			);
			if (response.errors.length > 0)
				throw new Error(response.errors.join(","));
			await loadCommits();
		} catch (e) {
			console.error(e);
		} finally {
			setRestoringId(null);
		}
	};

	return (
		<div className="flex flex-col gap-2 overflow-auto p-3">
			<p className="text-muted-foreground text-xs">
				Diff view isn't available yet — the underlying reactor doesn't
				return diff content. Restore reverts the project to this
				commit's state as a new commit; it never rewrites history.
			</p>
			{commits.map((commit) => (
				<div
					key={commit.commitId}
					className="flex items-center justify-between rounded-md border p-3 text-sm"
				>
					<div>
						<div className="font-medium">
							{commit.commitMessage}
						</div>
						<div className="text-muted-foreground text-xs">
							{commit.author.userId} ·{" "}
							{new Date(commit.date).toLocaleString()} ·{" "}
							{commit.commitId.slice(0, 7)}
						</div>
					</div>
					<Button
						size="sm"
						variant="outline"
						disabled={restoringId === commit.commitId}
						onClick={() => void restore(commit.commitId)}
					>
						Restore
					</Button>
				</div>
			))}
		</div>
	);
};
