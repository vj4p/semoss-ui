import type { ReactNode } from "react";
import { ThemeToggle } from "@semoss/ui/next";

export interface LoginShellProps {
	/** Logo and name, top left. */
	brand?: ReactNode;
	/** The hero image, already chosen for the current theme. Without one the default art shows. */
	heroSrc?: string;
	heroAlt?: string;
	/** The form column's content. */
	children: ReactNode;
}

/** Node centers as percentages of the panel; the lines use the same points. */
const ART_NODES = [
	{ label: "Database", x: 16, y: 22, className: "left-[16%] top-[22%]" },
	{ label: "Files", x: 16, y: 66, className: "left-[16%] top-[66%]" },
	{
		label: "Model",
		x: 50,
		y: 44,
		className: "left-[50%] top-[44%] border-primary text-primary-text",
	},
	{ label: "Insight", x: 80, y: 24, className: "left-[80%] top-[24%]" },
	{ label: "Agent", x: 80, y: 70, className: "left-[80%] top-[70%]" },
];

const ART_EDGES: [number, number][] = [
	[0, 2],
	[1, 2],
	[2, 3],
	[2, 4],
];

/** A quiet picture of the platform's parts, used when a theme supplies no hero image. */
export function LoginArt() {
	return (
		<div
			data-slot="login-art"
			aria-hidden="true"
			className="absolute inset-0 bg-muted"
		>
			<svg
				className="absolute inset-0 size-full"
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<g stroke="var(--border)" strokeWidth="1.5" fill="none">
					{ART_EDGES.map(([from, to]) => (
						<line
							key={`${from}-${to}`}
							x1={ART_NODES[from].x}
							y1={ART_NODES[from].y}
							x2={ART_NODES[to].x}
							y2={ART_NODES[to].y}
							vectorEffect="non-scaling-stroke"
						/>
					))}
				</g>
			</svg>
			{ART_NODES.map((node) => (
				<span
					key={node.label}
					className={`-translate-x-1/2 -translate-y-1/2 absolute rounded-lg border bg-card px-3 py-1.5 font-medium text-xs ${node.className}`}
				>
					{node.label}
				</span>
			))}
		</div>
	);
}

/**
 * The layout every sign-in screen shares. Pages keep their own redirect and
 * theme logic and pass in what to show.
 */
export function LoginShell({
	brand,
	heroSrc,
	heroAlt = "",
	children,
}: LoginShellProps) {
	return (
		<main className="grid min-h-svh bg-background text-foreground lg:grid-cols-2">
			<div className="relative flex flex-col gap-4 p-6 md:p-10">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 font-medium">
						{brand}
					</div>
					<ThemeToggle />
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-sm">{children}</div>
				</div>
			</div>
			<div
				data-slot="login-hero"
				className="relative hidden overflow-hidden border-s bg-muted lg:block"
			>
				{heroSrc ? (
					<img
						src={heroSrc}
						alt={heroAlt}
						aria-hidden={heroAlt ? undefined : true}
						className="absolute inset-0 size-full select-none object-cover"
					/>
				) : (
					<LoginArt />
				)}
			</div>
		</main>
	);
}
