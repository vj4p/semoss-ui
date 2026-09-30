import { ArrowLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "@semoss/i18n";
import { useInsight } from "@semoss/sdk/react";
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

/**
 * Settings page for configuring room defaults and preferences
 *
 * @name SettingsPage
 */
export const SettingsPage = () => {
	const { t } = useTranslation(["code", "room", "common"]);
	const navigate = useNavigate();
	const { insightId } = useInsight();
	const { harnesses } = useAgentHarnesses({ fallback: [] });

	const [modelId, setModelId] = useState<string>("");
	const [modelName, setModelName] = useState<string>("");
	const [harnessType, setHarnessType] = useState<string>("claude_code");
	const [temperature, setTemperature] = useState<number>(1.0);

	// Load settings from localStorage
	useEffect(() => {
		const saved = localStorage.getItem("code-settings");
		if (saved) {
			try {
				const settings = JSON.parse(saved);
				if (settings.modelId) setModelId(settings.modelId);
				if (settings.modelName) setModelName(settings.modelName);
				if (settings.harnessType) setHarnessType(settings.harnessType);
				if (settings.temperature !== undefined)
					setTemperature(settings.temperature);
			} catch (e) {
				console.error("Failed to load settings:", e);
			}
		}
	}, []);

	const handleSave = () => {
		const settings = {
			modelId,
			modelName,
			harnessType,
			temperature,
		};

		localStorage.setItem("code-settings", JSON.stringify(settings));
		console.log("Settings saved:", settings);

		// Navigate back to console
		navigate("/");
	};

	return (
		<div className="flex h-full flex-col bg-background text-foreground">
			{/* Header */}
			<div className="border-border border-b bg-card">
				<div className="flex items-center gap-4 p-4">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate("/")}
						className="gap-2"
					>
						<ArrowLeftIcon className="h-4 w-4" />
						Back to Console
					</Button>
					<h1 className="font-semibold text-xl">Settings</h1>
				</div>
			</div>

			{/* Content */}
			<ScrollArea className="flex-1">
				<div className="mx-auto max-w-2xl space-y-8 p-6">
					<FieldSet>
						<FieldLegend>Model Configuration</FieldLegend>
						<FieldDescription>
							Configure the default model and behavior for new
							sessions
						</FieldDescription>

						<FieldGroup>
							<Field>
								<FieldLabel>Model</FieldLabel>
								<EngineSelect
									name={modelName || "Select a model"}
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
								<FieldDescription>
									Choose which model to use for agent runs
								</FieldDescription>
							</Field>

							<Field>
								<FieldLabel>Agent Harness</FieldLabel>
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
									Select the agent harness type for this room
								</FieldDescription>
							</Field>

							<Field>
								<FieldLabel>
									Temperature: {temperature.toFixed(1)}
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
									Controls randomness. Lower values are more
									focused and deterministic, higher values are
									more creative
								</FieldDescription>
							</Field>
						</FieldGroup>
					</FieldSet>

					<FieldSet>
						<FieldLegend>Workspace Integration</FieldLegend>
						<FieldDescription>
							Connect this console to a workspace to inherit MCP
							tools, prompts, and settings
						</FieldDescription>

						<FieldGroup>
							<Field>
								<FieldLabel>Select Workspace</FieldLabel>
								<Select disabled>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="No workspace" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">
											No workspace
										</SelectItem>
									</SelectContent>
								</Select>
								<FieldDescription className="text-muted-foreground">
									Workspace selection coming soon
								</FieldDescription>
							</Field>
						</FieldGroup>
					</FieldSet>

					<div className="flex justify-end gap-3 border-border border-t pt-6">
						<Button variant="outline" onClick={() => navigate("/")}>
							Cancel
						</Button>
						<Button onClick={handleSave}>Save Settings</Button>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
};
