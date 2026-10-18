import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "./button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import { type Theme, useTheme } from "./theme-provider";

/** The words the toggle shows; hosts pass translations, English is the default. */
export interface ThemeToggleLabels {
	trigger: string;
	light: string;
	dark: string;
	system: string;
}

const DEFAULT_LABELS: ThemeToggleLabels = {
	trigger: "Theme",
	light: "Light",
	dark: "Dark",
	system: "System",
};

const OPTIONS = [
	{ value: "light", Icon: Sun },
	{ value: "dark", Icon: Moon },
	{ value: "system", Icon: Monitor },
] as const;

const isTheme = (value: string): value is Theme =>
	value === "light" || value === "dark" || value === "system";

/**
 * Icon button that opens a Light, Dark and System menu. Put it in an app's
 * header so appearance is one click away, whatever the app's own menus hold.
 * Must render inside a ThemeProvider.
 */
export function ThemeToggle({
	labels,
}: {
	labels?: Partial<ThemeToggleLabels>;
}) {
	const text = { ...DEFAULT_LABELS, ...labels };
	const { theme, resolvedTheme, setTheme } = useTheme();
	const Current = resolvedTheme === "dark" ? Moon : Sun;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label={text.trigger}>
					<Current aria-hidden />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuRadioGroup
					value={theme}
					onValueChange={(value) => {
						if (isTheme(value)) {
							setTheme(value);
						}
					}}
				>
					{OPTIONS.map(({ value, Icon }) => (
						<DropdownMenuRadioItem key={value} value={value}>
							<Icon aria-hidden className="size-4" />
							{text[value]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
