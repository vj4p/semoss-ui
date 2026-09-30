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
	Slider,
} from "@semoss/ui/next";
import { OverlayContainer } from "./overlay-container";

interface SettingsOverlayProps {
	open: boolean;
	onDismiss: () => void;
	session: Session;
}

/**
 * Settings overlay for configuring room options
 *
 * Allows selection of:
 * - Model
 * - Agent harness type
 * - Workspace
 * - MCP tools (future)
 * - Temperature and other parameters
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
	const [harnessType, setHarnessType] = useState<string>("claude_code");
	const [temperature, setTemperature] = useState<number>(1.0);
	const [workspaceId, setWorkspaceId] = useState<string>("");

	// Load current settings from session state
	useEffect(() => {
		if (!open) return;

		const state = session.getState();
		if (state.model?.app_id) {
			setModelId(state.model.app_id);
			setModelName(
				state.model.engine_display_name || state.model.app_name || "",
			);
		}
		if (state.harnessType) {
			setHarnessType(state.harnessType);
		}
		if (typeof state.temperature === "number") {
			setTemperature(state.temperature);
		}
	}, [open, session]);

	const handleApply = () => {
		// Apply settings to session
		const updates: Record<string, unknown> = {};

		if (modelId) {
			updates.model = { app_id: modelId, app_name: modelName };
		}
		if (harnessType) {
			updates.harnessType = harnessType;
		}
		if (typeof temperature === "number") {
			updates.temperature = temperature;
		}

		// Update session state
		session.setState(updates);
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
										if (engine) {
											setModelId(engine.app_id);
											setModelName(
												engine.engine_display_name ||
													engine.app_name ||
													"",
											);
										}
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
									value={harnessType}
									onValueChange={setHarnessType}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{harnesses.map((harness) => (
											<SelectItem
												key={harness.name}
												value={harness.name}
											>
												{harness.label || harness.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FieldDescription>
									{t("settings.harness.description")}
								</FieldDescription>
							</Field>

							<Field>
								<FieldLabel>
									{t("settings.temperature.label")}:{" "}
									{temperature.toFixed(1)}
								</FieldLabel>
								<Slider
									value={[temperature]}
									onValueChange={([value]) =>
										setTemperature(value)
									}
									min={0}
									max={2}
									step={0.1}
									className="w-full"
								/>
								<FieldDescription>
									{t("settings.temperature.description")}
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

						<Field>
							<FieldLabel>
								{t("settings.workspace.label")}
							</FieldLabel>
							<Select
								value={workspaceId}
								onValueChange={setWorkspaceId}
							>
								<SelectTrigger className="w-full">
									<SelectValue
										placeholder={t(
											"settings.workspace.none",
										)}
									/>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="">
										{t("settings.workspace.none")}
									</SelectItem>
									{/* Workspace list would be populated from API */}
								</SelectContent>
							</Select>
							<FieldDescription>
								{t("settings.workspace.comingSoon")}
							</FieldDescription>
						</Field>
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
