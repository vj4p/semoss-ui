import { CheckIcon, PaletteIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "@semoss/i18n";
import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@semoss/ui/next";
import { useColorTheme } from "@/hooks";

/**
 * The harness accent from useColorTheme. Persists to localStorage and applies
 * immediately. Light and dark mode live in the header's ThemeToggle.
 */
export const ThemePicker = observer(() => {
	const { t } = useTranslation("common");
	const { colorTheme, setColorTheme, colorThemes } = useColorTheme();

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
