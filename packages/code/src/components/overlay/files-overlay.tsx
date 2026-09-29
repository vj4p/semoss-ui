import { useEffect, useState } from "react";
import { Spinner } from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";

export interface FilesOverlayProps {
	open: boolean;
	onDismiss: () => void;
}

interface FileNode {
	name: string;
	path: string;
	type: "file" | "directory";
	children?: FileNode[];
}

/**
 * The `:files` overlay — browse files in the current workspace. For now, a
 * placeholder that demonstrates the overlay pattern. Phase 4a establishes the
 * infrastructure; real file browsing comes next.
 */
export const FilesOverlay = ({ open, onDismiss }: FilesOverlayProps) => {
	const [loading, setLoading] = useState(true);
	const [files, setFiles] = useState<FileNode[]>([]);

	useEffect(() => {
		if (!open) {
			return;
		}

		// TODO: Load actual file tree from SDK or Bash pixel
		// For now, show a placeholder structure
		setLoading(true);
		setTimeout(() => {
			setFiles([
				{
					name: "src",
					path: "/src",
					type: "directory",
					children: [
						{
							name: "index.ts",
							path: "/src/index.ts",
							type: "file",
						},
						{ name: "app.tsx", path: "/src/app.tsx", type: "file" },
					],
				},
				{
					name: "docs",
					path: "/docs",
					type: "directory",
					children: [
						{
							name: "README.md",
							path: "/docs/README.md",
							type: "file",
						},
					],
				},
				{ name: "package.json", path: "/package.json", type: "file" },
			]);
			setLoading(false);
		}, 500);
	}, [open]);

	const renderTree = (nodes: FileNode[], depth = 0) => {
		return nodes.map((node) => (
			<div key={node.path}>
				<div
					className="flex items-center gap-2 rounded px-2 py-1 font-mono text-sm hover:bg-accent/50"
					style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
				>
					<span className="text-muted-foreground">
						{node.type === "directory" ? "📁" : "📄"}
					</span>
					<span>{node.name}</span>
				</div>
				{node.children && renderTree(node.children, depth + 1)}
			</div>
		));
	};

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":files">
			{loading ? (
				<div className="flex items-center justify-center py-12">
					<Spinner />
				</div>
			) : (
				<div className="space-y-1">
					<p className="mb-4 font-mono text-muted-foreground text-sm">
						File browser (Phase 4a placeholder — real file tree
						integration coming next)
					</p>
					{renderTree(files)}
				</div>
			)}
		</OverlayContainer>
	);
};
