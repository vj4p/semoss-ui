import { type PropsWithChildren, useMemo } from "react";
import { useInsight } from "@semoss/sdk/react";
import type { ThemeMap } from "@semoss/shared";
import { Spinner } from "@semoss/ui/next";
import { RootContext } from "@/contexts";
import { RootStore } from "@/stores";

export const RootLayout = ({ children }: PropsWithChildren) => {
	const { system } = useInsight();

	// set up the store
	const rootStore = useMemo(() => {
		const store = new RootStore();

		if (system?.config?.theme) {
			// parse the theme
			let theme: Partial<ThemeMap["playground"]> = {};

			const rawTheme = system.config.theme.THEME_MAP || null || "{}";
			try {
				if (rawTheme) {
					const parsedTheme = JSON.parse(String(rawTheme));
					// Prefer this app's own theme slot. Without it the harness
					// renders the platform's Playground branding — same name,
					// logo and colors — because that was the only slot that
					// existed.
					if (parsedTheme?.harness) {
						theme = parsedTheme.harness;
					} else if (parsedTheme?.playground) {
						// Inherit Playground's styling so themed deployments
						// that predate the `harness` slot keep their colors and
						// logos, but drop its `name` — otherwise this app
						// announces itself as "Playground" in the title bar and
						// in assistant copy. VITE_NAME supplies our own.
						const { name: _playgroundName, ...styling } =
							parsedTheme.playground;
						theme = styling;
					}
				}
			} catch (_e) {}

			store.initialize(theme);
		}

		return store;
	}, [system.config.theme]);

	if (!rootStore.isInitialized) {
		return (
			<div className="flex h-full w-full items-center justify-center">
				<Spinner />
			</div>
		);
	}

	return (
		<RootContext.Provider
			value={{
				root: rootStore,
			}}
		>
			{children}
		</RootContext.Provider>
	);
};
