import { useEffect, useState } from "react";
import type { Session } from "@semoss/agent-core";
import { useTranslation } from "@semoss/i18n";
import { EngineSelect, useAgentHarnesses } from "@semoss/shared";
import {
	Button,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
	ScrollArea,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";

interface SettingsOverlayProps {
	open: boolean;
	onDismiss: () => void;
	session: Session;
}

/**
 * Settings overlay for configuring room options.
 *
 * Allows selection of the model and the agent harness, through the same
 * `setModel`/`setHarness` the `:model` and `:harness` commands call, so a
 * change made here can never drift from what the prompt can do. Workspace
 * and MCP tool management are not session concerns (`:mcp` owns tools) and
 * are shown here only as a coming-soon notice.
 */
export const SettingsOverlay = ({
	open,
	onDismiss,
	session,
}: SettingsOverlayProps) => {
	const { t } = useTranslation(["code", "room", "common"]);
	const { harnesses } = useAgentHarnesses({ fallback: [] });

	const [modelId, setModelId] = useState<string>("");
	const [modelName, setModelName] = useState<string>("");
	const [harness, setHarness] = useState<string>("");

	// Load current settings from session state
	useEffect(() => {
		if (!open) return;

		const state = session.getState();
		setModelId(state.modelId ?? "");
		setModelName(
			state.catalog.models.find((model) => model.id === state.modelId)
				?.name ?? "",
		);
		setHarness(state.harness ?? "");
	}, [open, session]);

	const handleApply = async () => {
		if (modelId && modelId !== session.getState().modelId) {
			await session.setModel(modelId);
		}
		if (harness && harness !== session.getState().harness) {
			await session.setHarness(harness);
		}
		onDismiss();
	};

	return (
		<OverlayContainer
			open={open}
			onDismiss={onDismiss}
			title={t("settings.title")}
		>
			<ScrollArea className="h-full">
				<div className="space-y-6 p-6">
					<FieldSet>
						<FieldLegend>{t("settings.model.title")}</FieldLegend>
						<FieldDescription>
							{t("settings.model.description")}
						</FieldDescription>

						<FieldGroup>
							<Field>
								<FieldLabel>
									{t("settings.model.label")}
								</FieldLabel>
								<EngineSelect
									name={modelName}
									value={modelId}
									engineTypes={["MODEL"]}
									metaFilters={[{ tag: "text-generation" }]}
									onChange={(engine) => {
										setModelId(engine.engine_id);
										setModelName(
											engine.engine_display_name ||
												engine.engine_name,
										);
									}}
									popoverContentProps={{
										align: "start",
									}}
								/>
							</Field>

							<Field>
								<FieldLabel>
									{t("settings.harness.label")}
								</FieldLabel>
								<Select
									value={harness}
									onValueChange={setHarness}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{harnesses.map((option) => (
											<SelectItem
												key={option.name}
												value={option.name}
											>
												{option.label || option.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FieldDescription>
									{t("settings.harness.description")}
								</FieldDescription>
							</Field>
						</FieldGroup>
					</FieldSet>

					<FieldSet>
						<FieldLegend>
							{t("settings.workspace.title")}
						</FieldLegend>
						<FieldDescription>
							{t("settings.workspace.description")}
						</FieldDescription>
						<FieldDescription>
							{t("settings.workspace.comingSoon")}
						</FieldDescription>
					</FieldSet>

					<FieldSet>
						<FieldLegend>{t("settings.mcp.title")}</FieldLegend>
						<FieldDescription>
							{t("settings.mcp.description")}
						</FieldDescription>
						<FieldDescription>
							{t("settings.mcp.comingSoon")}
						</FieldDescription>
					</FieldSet>

					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onDismiss}>
							{t("common:cancel")}
						</Button>
						<Button onClick={handleApply}>
							{t("common:apply")}
						</Button>
					</div>
				</div>
			</ScrollArea>
		</OverlayContainer>
	);
};
