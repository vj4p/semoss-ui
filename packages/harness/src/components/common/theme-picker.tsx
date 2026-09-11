import {
	CheckIcon,
	MonitorIcon,
	MoonIcon,
	PaletteIcon,
	SunIcon,
} from "lucide-react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "@semoss/i18n";
import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Separator,
	type Theme,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
	useTheme,
} from "@semoss/ui/next";
import { useColorTheme, useRoot } from "@/hooks";

const MODES: { id: Theme; labelKey: string; Icon: typeof SunIcon }[] = [
	{ id: "light", labelKey: "theme.light", Icon: SunIcon },
	{ id: "dark", labelKey: "theme.dark", Icon: MoonIcon },
	{ id: "system", labelKey: "theme.system", Icon: MonitorIcon },
];

/**
 * Single control for appearance: the light/dark mode owned by the platform's
 * ThemeProvider, plus the harness accent from useColorTheme. Both persist to
 * localStorage and apply immediately.
 */
export const ThemePicker = observer(() => {
	const { t } = useTranslation("common");
	const { root } = useRoot();
	const { theme, setTheme } = useTheme();
	const { colorTheme, setColorTheme, colorThemes } = useColorTheme();

	// Respect the same flag that gates the existing Appearance menu.
	const darkModeEnabled = root.theme.featureFlags?.enableDarkMode !== false;

	return (
		<Popover>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							aria-label={t("theme.title")}
						>
							<PaletteIcon />
						</Button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent>{t("theme.title")}</TooltipContent>
			</Tooltip>

			<PopoverContent align="end" className="w-60">
				{darkModeEnabled && (
					<>
						<div className="mb-2 font-medium text-muted-foreground text-xs">
							{t("theme.mode")}
						</div>
						<div className="mb-3 grid grid-cols-3 gap-1.5">
							{MODES.map(({ id, labelKey, Icon }) => (
								<button
									key={id}
									type="button"
									onClick={() => setTheme(id)}
									aria-pressed={theme === id}
									className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs transition-colors hover:bg-muted/60 ${
										theme === id
											? "border-primary bg-muted/40 text-foreground"
											: "border-border text-muted-foreground"
									}`}
								>
									<Icon className="size-4" />
									{t(labelKey)}
								</button>
							))}
						</div>
						<Separator className="mb-3" />
					</>
				)}

				<div className="mb-2 font-medium text-muted-foreground text-xs">
					{t("theme.accent")}
				</div>
				<div className="flex flex-col gap-0.5">
					{colorThemes.map(({ id, label, swatch }) => (
						<button
							key={id}
							type="button"
							onClick={() => setColorTheme(id)}
							aria-pressed={colorTheme === id}
							className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
						>
							<span
								aria-hidden
								className="size-4 shrink-0 rounded-full border border-black/10"
								style={{ backgroundColor: swatch }}
							/>
							<span className="flex-1 text-start">{label}</span>
							{colorTheme === id && (
								<CheckIcon className="size-4 text-primary" />
							)}
						</button>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
});
