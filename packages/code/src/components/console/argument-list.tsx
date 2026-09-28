import type { ComponentProps } from "react";
import type { ToolArgument } from "@semoss/agent-core";
import { cn } from "@semoss/ui/next";

/**
 * A tool call's arguments, each under its key, as agent-core describes them:
 * whole, the telling one first, and with any invisible character revealed.
 * A value wraps rather than scrolls. Keys and values are left to right in any
 * language, as code is, and a value's block is only as wide as its text, so
 * that in a right-to-left console it sits under its key rather than across
 * the page from it.
 *
 * @name ArgumentList
 * @param props.args - The arguments, from `describeArguments` or a tool line.
 */
export const ArgumentList = ({
	args,
	className,
	...props
}: { args: readonly ToolArgument[] } & ComponentProps<"dl">) => (
	<dl className={cn("flex flex-col gap-2", className)} {...props}>
		{args.map(({ key, text }) => (
			<div key={key} className="min-w-0">
				<dt className="text-muted-foreground">
					<code dir="ltr">{key}</code>
				</dt>
				<dd>
					<pre
						dir="ltr"
						className="w-fit max-w-full whitespace-pre-wrap break-words"
					>
						{text}
					</pre>
				</dd>
			</div>
		))}
	</dl>
);
