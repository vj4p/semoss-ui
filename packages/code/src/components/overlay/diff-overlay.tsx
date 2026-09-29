import { useEffect, useState } from "react";
import { runPixel } from "@semoss/sdk";
import { Spinner } from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";

export interface DiffOverlayProps {
	open: boolean;
	onDismiss: () => void;
}

interface DiffSection {
	file: string;
	additions: number;
	deletions: number;
	lines: DiffLine[];
}

interface DiffLine {
	type: "context" | "addition" | "deletion" | "header";
	content: string;
	lineNumber?: {
		old?: number;
		new?: number;
	};
}

/**
 * The `:diff` overlay — shows git diff for the current working directory.
 * Displays file changes with syntax highlighting for additions/deletions.
 * Phase 4b.
 */
const parseDiff = (output: string): DiffSection[] => {
	const sections: DiffSection[] = [];
	const lines = output.split("\n");
	let currentSection: DiffSection | null = null;

	for (const line of lines) {
		if (line.startsWith("diff --git")) {
			// Save previous section if any
			if (currentSection) {
				sections.push(currentSection);
			}
			// Start new section
			const match = line.match(/diff --git a\/(.*) b\/(.*)/);
			currentSection = {
				file: match?.[1] ?? "unknown",
				additions: 0,
				deletions: 0,
				lines: [],
			};
		} else if (currentSection) {
			if (line.startsWith("@@")) {
				currentSection.lines.push({
					type: "header",
					content: line,
				});
			} else if (line.startsWith("+") && !line.startsWith("+++")) {
				currentSection.additions++;
				currentSection.lines.push({
					type: "addition",
					content: line.slice(1),
				});
			} else if (line.startsWith("-") && !line.startsWith("---")) {
				currentSection.deletions++;
				currentSection.lines.push({
					type: "deletion",
					content: line.slice(1),
				});
			} else if (
				line.startsWith(" ") ||
				(!line.startsWith("index") &&
					!line.startsWith("---") &&
					!line.startsWith("+++"))
			) {
				currentSection.lines.push({
					type: "context",
					content: line.startsWith(" ") ? line.slice(1) : line,
				});
			}
		}
	}

	// Save last section
	if (currentSection) {
		sections.push(currentSection);
	}

	return sections;
};

export const DiffOverlay = ({ open, onDismiss }: DiffOverlayProps) => {
	const [loading, setLoading] = useState(true);
	const [sections, setSections] = useState<DiffSection[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [hasChanges, setHasChanges] = useState(false);

	useEffect(() => {
		if (!open) {
			return;
		}

		const loadDiff = async () => {
			setLoading(true);
			setError(null);

			try {
				// First check if there are any changes
				const statusResult = await runPixel(
					'Bash(command=["git status --porcelain"]);',
				);

				const statusOutput =
					typeof statusResult === "string"
						? statusResult
						: JSON.stringify(statusResult);

				if (!statusOutput.trim()) {
					setHasChanges(false);
					setSections([]);
					setLoading(false);
					return;
				}

				setHasChanges(true);

				// Get the diff output
				const diffResult = await runPixel(
					'Bash(command=["git diff HEAD"]);',
				);

				const diffOutput =
					typeof diffResult === "string"
						? diffResult
						: JSON.stringify(diffResult);

				// Parse the diff output
				const parsed = parseDiff(diffOutput);
				setSections(parsed);
			} catch (err) {
				console.error("Failed to load diff:", err);
				setError(
					err instanceof Error
						? err.message
						: "Failed to load git diff",
				);
			} finally {
				setLoading(false);
			}
		};

		loadDiff();
	}, [open]);

	const getLineColor = (type: DiffLine["type"]) => {
		switch (type) {
			case "addition":
				return "bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-100";
			case "deletion":
				return "bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100";
			case "header":
				return "bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100";
			case "context":
				return "text-muted-foreground";
		}
	};

	const getLinePrefix = (type: DiffLine["type"]) => {
		switch (type) {
			case "addition":
				return "+";
			case "deletion":
				return "-";
			case "header":
				return "";
			case "context":
				return " ";
		}
	};

	return (
		<OverlayContainer open={open} onDismiss={onDismiss} title=":diff">
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
						Unable to load git diff
					</p>
				</div>
			) : !hasChanges ? (
				<div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
					<p className="font-mono text-muted-foreground text-sm">
						No changes to show
					</p>
					<p className="text-muted-foreground text-xs">
						Working directory is clean
					</p>
				</div>
			) : (
				<div className="space-y-4">
					<p className="font-mono text-muted-foreground text-sm">
						Git diff ({sections.length} file
						{sections.length !== 1 ? "s" : ""} changed)
					</p>
					{sections.map((section, index) => (
						<div
							key={`${section.file}-${index}`}
							className="space-y-2"
						>
							<div className="sticky top-0 flex items-center justify-between border-b bg-background py-2">
								<span className="font-mono font-semibold text-sm">
									{section.file}
								</span>
								<span className="font-mono text-muted-foreground text-xs">
									<span className="text-green-600 dark:text-green-400">
										+{section.additions}
									</span>
									{" / "}
									<span className="text-red-600 dark:text-red-400">
										-{section.deletions}
									</span>
								</span>
							</div>
							<div className="overflow-x-auto rounded border font-mono text-xs">
								{section.lines.map((line, lineIndex) => (
									<div
										key={`${section.file}-${lineIndex}-${line.type}-${line.content.slice(0, 20)}`}
										className={`${getLineColor(line.type)} px-3 py-0.5`}
									>
										<span className="inline-block w-4 select-none">
											{getLinePrefix(line.type)}
										</span>
										<span className="whitespace-pre">
											{line.content}
										</span>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</OverlayContainer>
	);
};
