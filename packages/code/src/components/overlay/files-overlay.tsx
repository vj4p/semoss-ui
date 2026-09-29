import type React from "react";
import { useEffect, useState } from "react";
import { runPixel } from "@semoss/sdk";
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
	size?: number;
	children?: FileNode[];
	expanded?: boolean;
}

/**
 * The `:files` overlay — browse files in the current workspace.
 * Loads real file tree from the file system via Bash commands.
 */
export const FilesOverlay = ({ open, onDismiss }: FilesOverlayProps) => {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [files, setFiles] = useState<FileNode[]>([]);
	const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		if (!open) {
			return;
		}

		const loadFiles = async () => {
			setLoading(true);
			setError(null);

			try {
				// Get current working directory first
				const cwdResult = (await runPixel(
					'Bash(command=["pwd"]);',
				)) as unknown;
				let cwd = ".";
				if (typeof cwdResult === "string") {
					const trimmed = cwdResult.trim();
					if (trimmed) {
						cwd = trimmed;
					}
				}

				// Get file tree using find command
				// Excludes common directories that shouldn't be browsed
				const findCommand = `find "${cwd}" -maxdepth 4 \\
					\\( -path "*/node_modules" -o \\
					   -path "*/.git" -o \\
					   -path "*/dist" -o \\
					   -path "*/build" -o \\
					   -path "*/target" -o \\
					   -path "*/.next" -o \\
					   -path "*/__pycache__" \\
					\\) -prune -o -print`;

				const result = (await runPixel(
					`Bash(command=["${findCommand.replace(/"/g, '\\"')}"]);`,
				)) as unknown;

				const output =
					typeof result === "string"
						? result
						: JSON.stringify(result);
				const lines = output.split("\n").filter((line) => line.trim());

				// Build tree structure
				const tree = buildFileTree(lines, cwd);
				setFiles(tree);
			} catch (err) {
				console.error("Failed to load files:", err);
				setError(
					err instanceof Error
						? err.message
						: "Failed to load file tree",
				);
			} finally {
				setLoading(false);
			}
		};

		loadFiles();
	}, [open]);

	const toggleExpanded = (path: string) => {
		setExpandedPaths((prev) => {
			const next = new Set(prev);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	};

	const copyPath = (path: string) => {
		navigator.clipboard.writeText(path);
	};

	// Filter tree by search query
	const filterTree = (nodes: FileNode[], query: string): FileNode[] => {
		if (!query) return nodes;

		const lowerQuery = query.toLowerCase();
		const filtered = nodes
			.map((node) => {
				const matchesName = node.name
					.toLowerCase()
					.includes(lowerQuery);
				const children = node.children
					? filterTree(node.children, query)
					: undefined;
				const hasMatchingChildren = children && children.length > 0;

				if (matchesName || hasMatchingChildren) {
					return { ...node, children };
				}
				return null;
			})
			.filter((node) => node !== null) as FileNode[];
		return filtered;
	};

	const renderTree = (nodes: FileNode[], depth = 0): React.ReactElement[] => {
		return nodes.map((node) => {
			const isExpanded = expandedPaths.has(node.path);
			const hasChildren = node.children && node.children.length > 0;

			return (
				<div key={node.path}>
					<button
						type="button"
						onClick={() => {
							if (node.type === "directory") {
								toggleExpanded(node.path);
							} else {
								copyPath(node.path);
							}
						}}
						className="flex w-full items-center gap-2 rounded px-2 py-1 font-mono text-sm hover:bg-accent/50"
						style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
						title={
							node.type === "directory"
								? "Click to expand/collapse"
								: "Click to copy path"
						}
					>
						{node.type === "directory" && (
							<span className="text-muted-foreground">
								{isExpanded ? "▾" : "▸"}
							</span>
						)}
						<span className="text-muted-foreground">
							{node.type === "directory"
								? "📁"
								: getFileIcon(node.name)}
						</span>
						<span className="flex-1 truncate">{node.name}</span>
						{node.size !== undefined && (
							<span className="text-muted-foreground text-xs">
								{formatFileSize(node.size)}
							</span>
						)}
					</button>
					{node.type === "directory" &&
						isExpanded &&
						hasChildren &&
						node.children &&
						renderTree(node.children, depth + 1)}
				</div>
			);
		});
	};

	const filteredFiles = filterTree(files, searchQuery);

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":files">
			<div className="flex flex-col gap-4">
				{/* Search input */}
				<div className="sticky top-0 bg-background pb-2">
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search files..."
						className="w-full rounded border bg-background px-3 py-2 font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
					/>
				</div>

				{loading ? (
					<div className="flex items-center justify-center py-12">
						<Spinner />
					</div>
				) : error ? (
					<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
						<p className="font-mono text-red-600 text-sm dark:text-red-400">
							{error}
						</p>
						<p className="text-muted-foreground text-xs">
							Unable to load file tree
						</p>
					</div>
				) : filteredFiles.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
						<p className="font-mono text-muted-foreground text-sm">
							{searchQuery
								? "No matching files"
								: "No files found"}
						</p>
					</div>
				) : (
					<div className="space-y-1 overflow-y-auto">
						<p className="mb-2 font-mono text-muted-foreground text-xs">
							Click directories to expand/collapse • Click files
							to copy path
						</p>
						{renderTree(filteredFiles)}
					</div>
				)}
			</div>
		</OverlayContainer>
	);
};

/**
 * Build a hierarchical tree from flat file paths.
 */
const buildFileTree = (paths: string[], rootPath: string): FileNode[] => {
	const tree: FileNode[] = [];
	const pathMap = new Map<string, FileNode>();

	// Sort paths so directories come before their contents
	const sortedPaths = [...paths].sort();

	for (const fullPath of sortedPaths) {
		if (!fullPath || fullPath === rootPath) continue;

		// Get relative path from root
		const relativePath = fullPath.startsWith(rootPath)
			? fullPath.slice(rootPath.length).replace(/^\//, "")
			: fullPath;

		if (!relativePath) continue;

		const parts = relativePath.split("/");
		const name = parts[parts.length - 1];

		// Determine if it's a directory (heuristic: ends with no extension or is a known directory)
		const isDirectory =
			fullPath.endsWith("/") ||
			!name.includes(".") ||
			[
				"src",
				"lib",
				"components",
				"hooks",
				"pages",
				"api",
				"utils",
			].includes(name);

		const node: FileNode = {
			name,
			path: fullPath,
			type: isDirectory ? "directory" : "file",
			children: isDirectory ? [] : undefined,
		};

		pathMap.set(fullPath, node);

		// Find parent
		if (parts.length === 1) {
			// Top-level node
			tree.push(node);
		} else {
			// Child node - find parent directory
			const parentPath = parts.slice(0, -1).join("/");
			const fullParentPath = rootPath
				? `${rootPath}/${parentPath}`
				: parentPath;
			let parent = pathMap.get(fullParentPath);

			// Create parent if it doesn't exist
			if (!parent) {
				parent = {
					name: parts[parts.length - 2],
					path: fullParentPath,
					type: "directory",
					children: [],
				};
				pathMap.set(fullParentPath, parent);

				// Add parent to tree or its parent
				if (parts.length === 2) {
					tree.push(parent);
				}
			}

			if (parent.children) {
				parent.children.push(node);
			}
		}
	}

	return tree;
};

/**
 * Get an appropriate icon for a file based on its extension.
 */
const getFileIcon = (filename: string): string => {
	const ext = filename.split(".").pop()?.toLowerCase();

	switch (ext) {
		case "ts":
		case "tsx":
		case "js":
		case "jsx":
			return "📄";
		case "json":
			return "📋";
		case "md":
			return "📝";
		case "css":
		case "scss":
			return "🎨";
		case "test.ts":
		case "test.tsx":
		case "spec.ts":
			return "🧪";
		case "py":
			return "🐍";
		case "java":
			return "☕";
		case "xml":
		case "html":
			return "📰";
		case "yml":
		case "yaml":
			return "⚙️";
		default:
			return "📄";
	}
};

/**
 * Format file size in human-readable format.
 */
const formatFileSize = (bytes: number): string => {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};
