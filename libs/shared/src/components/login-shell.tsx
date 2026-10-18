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

const ART_NODES = [
	{ label: "Database", className: "start-[8%] top-[18%]" },
	{ label: "Files", className: "start-[8%] top-[60%]" },
	{
		label: "Model",
		className: "start-[38%] top-[38%] border-primary text-primary-text",
	},
	{ label: "Insight", className: "start-[66%] top-[20%]" },
	{ label: "Agent", className: "start-[66%] top-[64%]" },
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
				viewBox="0 0 480 560"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<g stroke="var(--border)" strokeWidth="1.5" fill="none">
					<path d="M95 115L225 215" />
					<path d="M80 325L225 215" />
					<path d="M235 215L340 135" />
					<path d="M235 215L335 375" />
				</g>
			</svg>
			{ART_NODES.map((node) => (
				<span
					key={node.label}
					className={`absolute rounded-lg border bg-card px-3 py-1.5 font-medium text-xs ${node.className}`}
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
		<div className="grid min-h-svh bg-background text-foreground lg:grid-cols-2">
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
		</div>
	);
}
