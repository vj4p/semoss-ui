import { useState } from "react";
import { useParams } from "react-router";
import { useInsight } from "@semoss/sdk/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@semoss/ui/next";
import { ChatPanel } from "../components/chat/chat-panel";
import { FilesPanel } from "../components/files/files-panel";
import { VersionsPanel } from "../components/versions/versions-panel";

type RightTab = "FILES" | "VERSIONS";

export const ProjectWorkspacePage = () => {
	const { projectId } = useParams<{ projectId: string }>();
	const insight = useInsight();
	const [rightTab, setRightTab] = useState<RightTab>("FILES");

	if (!projectId) return null;
	if (insight.error) {
		return (
			<div className="p-4 text-destructive text-sm">
				Failed to load: {insight.error.message}
			</div>
		);
	}
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
				<Tabs
					value={rightTab}
					onValueChange={(value) => setRightTab(value as RightTab)}
					className="flex-1"
				>
					<TabsList>
						<TabsTrigger value="FILES">Files</TabsTrigger>
						<TabsTrigger value="VERSIONS">Versions</TabsTrigger>
					</TabsList>
					<TabsContent
						value="FILES"
						className="flex-1 overflow-hidden"
					>
						<FilesPanel key={projectId} projectId={projectId} />
					</TabsContent>
					<TabsContent
						value="VERSIONS"
						className="flex-1 overflow-hidden"
					>
						<VersionsPanel key={projectId} projectId={projectId} />
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
};
