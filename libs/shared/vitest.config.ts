import { createViteConfig } from "@semoss/config";

export default createViteConfig({
	rootDir: import.meta.dirname,
	enableReact: true,
	enableTailwind: false,
	test: {
		environment: "jsdom",
		globals: true,
		coverage: {
			reportsDirectory: "./coverage",
			include: ["src/**"],
		},
	},
});
