import { useState } from "react";
import { useParams } from "react-router";
import { useInsight } from "@semoss/sdk/react";
import { ChatPanel } from "../components/chat/chat-panel";
import { FilesPanel } from "../components/files/files-panel";
import { VersionsPanel } from "../components/versions/versions-panel";

type RightTab = "FILES" | "VERSIONS";

export const ProjectWorkspacePage = () => {
	const { projectId } = useParams<{ projectId: string }>();
	const insight = useInsight();
	const [rightTab, setRightTab] = useState<RightTab>("FILES");

	if (!projectId) return null;
	if (!insight.isReady) return <div className="p-4">Loading…</div>;

	return (
		<div className="flex h-screen">
			<div className="flex w-1/2 flex-col border-r">
				<ChatPanel
					key={projectId}
					projectId={projectId}
					insightId={insight.insightId}
				/>
			</div>
			<div className="flex w-1/2 flex-col">
				<div className="flex border-b">
					<button
						type="button"
						className={`px-4 py-2 text-sm ${rightTab === "FILES" ? "border-primary border-b-2 font-medium" : "text-muted-foreground"}`}
						onClick={() => setRightTab("FILES")}
					>
						Files
					</button>
					<button
						type="button"
						className={`px-4 py-2 text-sm ${rightTab === "VERSIONS" ? "border-primary border-b-2 font-medium" : "text-muted-foreground"}`}
						onClick={() => setRightTab("VERSIONS")}
					>
						Versions
					</button>
				</div>
				<div className="flex-1 overflow-hidden">
					{rightTab === "FILES" ? (
						<FilesPanel key={projectId} projectId={projectId} />
					) : (
						<VersionsPanel key={projectId} projectId={projectId} />
					)}
				</div>
			</div>
		</div>
	);
};
