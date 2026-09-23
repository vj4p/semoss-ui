import { createViteConfig } from "@semoss/config";

// environment: "node" is not just a default carried over from the SDK — it is
// the assertion. Nothing in this library may need a DOM, so a suite that only
// ever runs without one is what keeps that true.
export default createViteConfig({
	rootDir: import.meta.dirname,
	enableReact: false,
	enableTailwind: false,
	test: {
		environment: "node",
		pool: "forks",
	},
});
