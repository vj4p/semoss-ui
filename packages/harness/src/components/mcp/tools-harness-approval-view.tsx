import { observer } from "mobx-react-lite";
import { useState } from "react";
import { useTranslation } from "@semoss/i18n";
import { Button, Textarea, toast } from "@semoss/ui/next";
import type { ToolStore } from "@/stores";
import { decideAgentToolAction } from "@/stores/message/agent-harness";
import { ToolCardHeader, ToolTabScrollArea } from "./tool-card-tabs";

const asObject = (value: unknown): Record<string, unknown> => {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value);
			if (
				parsed &&
				typeof parsed === "object" &&
				!Array.isArray(parsed)
			) {
				return parsed as Record<string, unknown>;
			}
		} catch {
			// not JSON: shown as no arguments
		}
	}
	return {};
};

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

/**
 * Approval for a call a harness will run itself (Claude Code's Bash, Write, Edit). There is no tool schema to build a
 * form from, so this shows what will run and offers Approve (optionally with edited arguments) and Reject. The
 * decision resumes the agent, which allows an approved call once.
 */
export const ToolsHarnessApprovalView = observer(
	({ tool }: { tool: ToolStore }) => {
		const { t } = useTranslation("tool");
		const args = asObject(tool.pendingAction?.toolArgs);
		const command = typeof args.command === "string" ? args.command : null;
		const filePath =
			typeof args.file_path === "string" ? args.file_path : null;

		const [editing, setEditing] = useState(false);
		const [draft, setDraft] = useState(() => pretty(args));
		const [error, setError] = useState<string | null>(null);
		const [submitting, setSubmitting] = useState(false);
		const disabled = submitting;

		const decide = async (decision: "submit" | "reject") => {
			let edited: Record<string, unknown> | undefined;
			if (decision === "submit" && editing) {
				try {
					const parsed = JSON.parse(draft);
					if (
						!parsed ||
						typeof parsed !== "object" ||
						Array.isArray(parsed)
					) {
						setError(t("harnessApproval.notAnObject"));
						return;
					}
					edited = parsed as Record<string, unknown>;
				} catch {
					setError(t("harnessApproval.invalidJson"));
					return;
				}
			}
			setError(null);
			setSubmitting(true);
			try {
				await decideAgentToolAction(tool, decision, edited);
			} catch (e) {
				toast.error(
					e instanceof Error
						? e.message
						: t("harnessApproval.failed"),
				);
			} finally {
				setSubmitting(false);
			}
		};

		// Once the decision is in there is nothing left to approve; the agent's own call streams on its own.
		if (!tool.pendingAction) {
			return (
				<div className="flex h-full w-full flex-col overflow-hidden text-foreground">
					<ToolCardHeader title={tool.displayName} />
					<p className="px-4 text-muted-foreground text-sm">
						{t("harnessApproval.decided")}
					</p>
				</div>
			);
		}

		return (
			<div className="flex h-full w-full flex-col overflow-hidden text-foreground">
				<ToolCardHeader title={tool.displayName} />
				<ToolTabScrollArea>
					<div className="flex flex-col gap-4 px-4 pb-4">
						<p className="text-muted-foreground text-sm">
							{t("harnessApproval.intro")}
						</p>

						{command !== null && !editing && (
							<section className="flex flex-col gap-1.5">
								<h3 className="font-medium text-sm">
									{t("harnessApproval.command")}
								</h3>
								<pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-3 font-mono text-xs">
									{command}
								</pre>
							</section>
						)}
						{filePath !== null && !editing && (
							<section className="flex flex-col gap-1.5">
								<h3 className="font-medium text-sm">
									{t("harnessApproval.target")}
								</h3>
								<code className="break-all rounded-md border border-border bg-muted p-2 font-mono text-xs">
									{filePath}
								</code>
							</section>
						)}

						{editing ? (
							<section className="flex flex-col gap-1.5">
								<h3 className="font-medium text-sm">
									{t("harnessApproval.arguments")}
								</h3>
								<Textarea
									value={draft}
									onChange={(e) => {
										setDraft(e.target.value);
										setError(null);
									}}
									aria-label={t("harnessApproval.arguments")}
									className="min-h-40 font-mono text-xs"
									spellCheck={false}
								/>
							</section>
						) : (
							command === null &&
							filePath === null && (
								<section className="flex flex-col gap-1.5">
									<h3 className="font-medium text-sm">
										{t("harnessApproval.arguments")}
									</h3>
									<pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-3 font-mono text-xs">
										{pretty(args)}
									</pre>
								</section>
							)
						)}

						{error && (
							<p
								role="alert"
								className="text-destructive text-sm"
							>
								{error}
							</p>
						)}

						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="self-start"
							disabled={disabled}
							onClick={() => {
								setEditing((value) => !value);
								setDraft(pretty(args));
								setError(null);
							}}
						>
							{editing
								? t("harnessApproval.doneEditing")
								: t("harnessApproval.editArguments")}
						</Button>

						<div className="flex gap-2">
							<Button
								type="button"
								className="flex-1"
								disabled={disabled}
								onClick={() => decide("submit")}
							>
								{submitting
									? t("harnessApproval.approving")
									: t("harnessApproval.approve")}
							</Button>
							<Button
								type="button"
								variant="outline"
								className="flex-1"
								disabled={disabled}
								onClick={() => decide("reject")}
							>
								{t("harnessApproval.reject")}
							</Button>
						</div>
						<p className="text-muted-foreground text-xs">
							{t("harnessApproval.once")}
						</p>
					</div>
				</ToolTabScrollArea>
			</div>
		);
	},
);
