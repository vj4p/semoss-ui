import {
	GitBranchIcon,
	GitMergeIcon,
	Loader2Icon,
	RefreshCwIcon,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@semoss/i18n";
import { useInsight } from "@semoss/sdk/react";
import {
	Badge,
	Button,
	cn,
	ScrollArea,
	Skeleton,
	toast,
} from "@semoss/ui/next";
import type { RoomStore } from "@/stores";

interface RoomChangesProps {
	/** Room whose project's history is being reviewed. */
	room: RoomStore;
}

/** One entry from `ProjectGitBranches`. */
interface BranchInfo {
	name?: string;
	current?: boolean;
	remote?: boolean;
	commitId?: string;
	ahead?: number | null;
	behind?: number | null;
}

/**
 * One entry from `ProjectCommitDetails`.
 *
 * `author` is an object, not a string — rendering it directly gives
 * "[object Object]".
 */
interface CommitInfo {
	commitId?: string;
	commitMessage?: string;
	author?: { userId?: string; userEmail?: string };
	date?: string;
}

/** One changed file from `ProjectCommitDiff`. */
interface DiffFile {
	fileName?: string;
	changeType?: string;
	diff?: string;
	isBinary?: boolean;
	isTruncated?: boolean;
}

/**
 * How far back the log goes. Enough to see a branch's work without turning the
 * panel into a log viewer.
 */
/** `ProjectGitBranches` output. */
type BranchesOutput = {
	branches?: BranchInfo[];
	currentBranch?: string;
};

/**
 * `ProjectCommitDetails` output. It returns the rows directly on some paths and
 * wrapped on others, so both are accepted rather than guessed at.
 */
type CommitsOutput = CommitInfo[] | { commits?: CommitInfo[] };

/** `ProjectCommitDiff` output, same direct-or-wrapped tolerance. */
type DiffOutput = DiffFile[] | { files?: DiffFile[] };

const COMMIT_LIMIT = 15;

/** Badge colour per git change type, so a delete reads as a delete. */
const changeTypeVariant = (
	changeType?: string,
): "default" | "secondary" | "destructive" | "outline" => {
	switch ((changeType ?? "").toUpperCase()) {
		case "ADD":
			return "default";
		case "DELETE":
			return "destructive";
		case "RENAME":
		case "COPY":
			return "outline";
		default:
			return "secondary";
	}
};

/**
 * Review what the agent changed, and land it.
 *
 * The reactors for branch-per-task all existed and nothing in the harness used
 * them, so an agent could be told to work on a branch and there was no way for a
 * human to see the result or merge it. This is that surface: the branches, the
 * commits on the current one, the diff of any commit, and a merge.
 *
 * Every interpolated value goes through `JSON.stringify` rather than being wrapped in
 * hand-written quotes. Branch names are not this panel's own data — they are read back
 * from the repository, and git permits a double quote in a refname (only backslash is
 * rejected), so a branch arriving from a clone or the git CLI could otherwise close the
 * string literal and append its own Pixel. `ProjectGitCreateBranch` validates the names
 * it creates, which does nothing for the ones it did not.
 *
 * Reads are assembled from three reactors rather than one because none of them is
 * a branch-vs-branch diff. `ProjectGitDiff` — despite the name — computes a
 * *conflict* diff for a single file and requires a `side`, so it is no use here;
 * `ProjectCommitDiff` is the one that returns unified diff text per changed file.
 */
export const RoomChanges: React.FC<RoomChangesProps> = observer(({ room }) => {
	const { t } = useTranslation("room");
	const insight = useInsight();

	const projectId = room.options.project?.project_id;

	const [branches, setBranches] = useState<BranchInfo[]>([]);
	const [currentBranch, setCurrentBranch] = useState<string | null>(null);
	const [commits, setCommits] = useState<CommitInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [openCommitId, setOpenCommitId] = useState<string | null>(null);
	const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
	const [diffLoading, setDiffLoading] = useState(false);
	const [merging, setMerging] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!projectId) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			// One round trip: branches then the log.
			// Two calls on purpose. actions.run throws if *any* statement in the
			// batch errored, so batching these meant a project with no commit history
			// took the branch list down with it and the panel showed nothing at all.
			const branchResponse = await insight.actions.run<[BranchesOutput]>(
				`ProjectGitBranches(project=[${JSON.stringify(projectId)}]);`,
			);
			const branchData = (branchResponse.pixelReturn[0]?.output ??
				{}) as BranchesOutput;
			setBranches(branchData.branches ?? []);
			setCurrentBranch(branchData.currentBranch ?? null);

			// The log is best-effort: a project with no commits yet is normal and
			// should still show its branches rather than an error.
			try {
				const commitResponse = await insight.actions.run<
					[CommitsOutput]
				>(
					`ProjectCommitDetails(project=[${JSON.stringify(projectId)}], limit=[${COMMIT_LIMIT}], offset=[0]);`,
				);
				const commitData = commitResponse.pixelReturn[0]?.output as
					| CommitsOutput
					| undefined;
				setCommits(
					Array.isArray(commitData)
						? commitData
						: (commitData?.commits ?? []),
				);
			} catch (commitError) {
				console.error("Could not read the commit log", commitError);
				setCommits([]);
			}
		} catch (e) {
			setError((e as Error).message || t("changes.loadFailed"));
		} finally {
			setLoading(false);
		}
	}, [projectId, insight.actions, t]);

	useEffect(() => {
		void load();
	}, [load]);

	const openDiff = async (commitId: string) => {
		if (openCommitId === commitId) {
			setOpenCommitId(null);
			setDiffFiles([]);
			return;
		}
		setOpenCommitId(commitId);
		setDiffFiles([]);
		setDiffLoading(true);
		try {
			const { pixelReturn } = await insight.actions.run<[DiffOutput]>(
				`ProjectCommitDiff(project=[${JSON.stringify(projectId)}], commitId=[${JSON.stringify(commitId)}]);`,
			);
			const output = pixelReturn[0]?.output as DiffOutput | undefined;
			setDiffFiles(
				Array.isArray(output) ? output : (output?.files ?? []),
			);
		} catch (e) {
			toast.error((e as Error).message || t("changes.diffFailed"));
			setOpenCommitId(null);
		} finally {
			setDiffLoading(false);
		}
	};

	const checkout = async (branch: string) => {
		try {
			await insight.actions.run(
				`ProjectGitCheckout(project=[${JSON.stringify(projectId)}], branch=[${JSON.stringify(branch)}]);`,
			);
			toast.success(t("changes.checkedOut", { branch }));
			await load();
		} catch (e) {
			toast.error((e as Error).message || t("changes.checkoutFailed"));
		}
	};

	/**
	 * Merge a branch into the checked-out one.
	 *
	 * A conflicting merge is not an error — the reactor reports it and leaves the
	 * tree conflicted on purpose — so it gets its own message rather than being
	 * thrown. Telling the user "merge failed" when the truth is "there are
	 * conflicts to resolve" would send them looking in the wrong place.
	 */
	const merge = async (branch: string) => {
		setMerging(branch);
		try {
			const { pixelReturn } = await insight.actions.run<
				[
					{
						merged?: boolean;
						mergeStatus?: string;
						conflicts?: string[];
					},
				]
			>(
				`ProjectGitMerge(project=[${JSON.stringify(projectId)}], branch=[${JSON.stringify(branch)}]);`,
			);
			const result = pixelReturn[0];
			if (result?.operationType?.indexOf("ERROR") > -1) {
				throw new Error(
					typeof result.output === "string"
						? result.output
						: t("changes.mergeFailed"),
				);
			}
			const output = result?.output ?? {};
			if (output.merged) {
				toast.success(
					t("changes.merged", {
						branch,
						status: output.mergeStatus ?? "",
					}),
				);
			} else {
				toast.warning(
					t("changes.mergeConflicts", {
						count: output.conflicts?.length ?? 0,
					}),
				);
			}
			await load();
		} catch (e) {
			toast.error((e as Error).message || t("changes.mergeFailed"));
		} finally {
			setMerging(null);
		}
	};

	if (!projectId) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground text-sm">
				<GitBranchIcon className="size-5" />
				<p>{t("changes.noProject")}</p>
			</div>
		);
	}

	// Local branches only. A remote branch is not something this panel can merge
	// from without a fetch, and offering it would fail confusingly.
	const localBranches = branches.filter((b) => !b.remote);

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-border border-b px-3 py-2">
				<span className="font-semibold text-sm">
					{t("changes.title")}
				</span>
				{currentBranch ? (
					<Badge variant="secondary" className="gap-1">
						<GitBranchIcon className="size-3" />
						{currentBranch}
					</Badge>
				) : null}
				<Button
					size="sm"
					variant="ghost"
					className="ml-auto"
					disabled={loading}
					onClick={() => void load()}
				>
					<RefreshCwIcon
						className={cn("size-4", loading && "animate-spin")}
					/>
				</Button>
			</div>

			<ScrollArea className="flex-1">
				<div className="flex flex-col gap-4 p-3">
					{error ? (
						<p className="text-destructive text-xs">{error}</p>
					) : null}

					{loading && branches.length === 0 ? (
						<div className="flex flex-col gap-2">
							<Skeleton className="h-8 w-full" />
							<Skeleton className="h-8 w-full" />
						</div>
					) : null}

					<section className="flex flex-col gap-2">
						<h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							{t("changes.branches")}
						</h4>
						{localBranches.length === 0 && !loading ? (
							<p className="text-muted-foreground text-xs">
								{t("changes.noBranches")}
							</p>
						) : null}
						{localBranches.map((branch) => (
							<div
								key={branch.name}
								className="flex items-center gap-2 rounded-md border border-border p-2"
							>
								<GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
								<span className="truncate font-mono text-xs">
									{branch.name}
								</span>
								{branch.current ? (
									<Badge
										variant="outline"
										className="text-[10px]"
									>
										{t("changes.current")}
									</Badge>
								) : null}
								<div className="ml-auto flex items-center gap-1">
									{branch.current ? null : (
										<>
											<Button
												size="sm"
												variant="ghost"
												onClick={() =>
													void checkout(
														branch.name ?? "",
													)
												}
											>
												{t("changes.checkout")}
											</Button>
											<Button
												size="sm"
												variant="outline"
												disabled={
													merging === branch.name
												}
												onClick={() =>
													void merge(
														branch.name ?? "",
													)
												}
											>
												<GitMergeIcon className="size-3" />
												{merging === branch.name
													? t("changes.merging")
													: t("changes.merge")}
											</Button>
										</>
									)}
								</div>
							</div>
						))}
					</section>

					<section className="flex flex-col gap-2">
						<h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							{t("changes.commits")}
						</h4>
						{commits.length === 0 && !loading ? (
							<p className="text-muted-foreground text-xs">
								{t("changes.noCommits")}
							</p>
						) : null}
						{commits.map((commit) => (
							<div
								key={commit.commitId}
								className="rounded-md border border-border"
							>
								<button
									type="button"
									className="flex w-full flex-col gap-0.5 p-2 text-left hover:bg-muted/50"
									onClick={() =>
										void openDiff(commit.commitId ?? "")
									}
								>
									<span className="truncate text-xs">
										{commit.commitMessage ??
											t("changes.noMessage")}
									</span>
									<span className="font-mono text-[10px] text-muted-foreground">
										{commit.commitId?.slice(0, 8)}
										{commit.author?.userId
											? ` · ${commit.author.userId}`
											: ""}
									</span>
								</button>

								{openCommitId === commit.commitId ? (
									<div className="border-border border-t p-2">
										{diffLoading ? (
											<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
										) : diffFiles.length === 0 ? (
											<p className="text-muted-foreground text-xs">
												{t("changes.noFiles")}
											</p>
										) : (
											<div className="flex flex-col gap-2">
												{diffFiles.map((file) => (
													<div
														key={file.fileName}
														className="flex flex-col gap-1"
													>
														<div className="flex items-center gap-2">
															<Badge
																variant={changeTypeVariant(
																	file.changeType,
																)}
																className="text-[10px]"
															>
																{file.changeType ??
																	"?"}
															</Badge>
															<span className="truncate font-mono text-[11px]">
																{file.fileName}
															</span>
														</div>
														{file.isBinary ? (
															<p className="text-[11px] text-muted-foreground italic">
																{t(
																	"changes.binary",
																)}
															</p>
														) : file.diff ? (
															<pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-[10px] leading-tight">
																{file.diff}
															</pre>
														) : null}
														{file.isTruncated ? (
															<p className="text-[10px] text-muted-foreground italic">
																{t(
																	"changes.truncated",
																)}
															</p>
														) : null}
													</div>
												))}
											</div>
										)}
									</div>
								) : null}
							</div>
						))}
					</section>
				</div>
			</ScrollArea>
		</div>
	);
});
