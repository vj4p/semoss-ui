import { memo } from "react";
import {
	entryLines,
	type ItemStatus,
	type Line,
	type Segment,
	type SessionEntry,
	STATUS_GLYPH,
	type Translate,
} from "@semoss/agent-core";
import { cn } from "@semoss/ui/next";
import { useElapsedSeconds, type useLineLabels } from "@/hooks";
import {
	EMPHASIS_CLASS,
	isLeftToRight,
	RUN_LINES_OPTIONS,
	STATUS_CLASS,
} from "@/utility";
import { ArgumentList } from "./argument-list";

type LineLabels = ReturnType<typeof useLineLabels>;

/**
 * A status as its glyph, which a screen reader skips: the row says the status
 * in words instead, after what the row is about.
 */
const StatusGlyph = ({ status }: { status: ItemStatus }) => (
	<span
		aria-hidden="true"
		className={cn(
			"inline-block w-4 shrink-0 text-center",
			STATUS_CLASS[status],
		)}
	>
		{STATUS_GLYPH[status]}
	</span>
);

/** One run of text, styled by its emphasis. */
const SegmentView = ({ segment }: { segment: Segment }) => {
	const { text, emphasis } = segment;
	if (emphasis === undefined) {
		return text;
	}
	const dir = isLeftToRight(emphasis) ? "ltr" : undefined;
	return emphasis === "code" ? (
		<code className={EMPHASIS_CLASS[emphasis]} dir={dir}>
			{text}
		</code>
	) : (
		<span className={EMPHASIS_CLASS[emphasis]} dir={dir}>
			{text}
		</span>
	);
};

/**
 * A tool call: its status, name and argument, then the size of its output,
 * and its error.
 *
 * A call with arguments or output to show is a disclosure, as reasoning is,
 * that opens on every argument, whole, and the output. Its body is drawn
 * while it is closed, so that the browser's find reaches it, and opens it.
 * A call with nothing more to show is a plain row. The error stays in sight
 * either way. The output is left to right, and as wide as its text, as an
 * argument's value is.
 *
 * While the call runs, its row counts the seconds since the console first
 * drew it running. A screen reader skips the count: the row names the
 * disclosure, whose name would otherwise change every second, and the status
 * bar keeps the run's time.
 */
const ToolLineView = ({
	line,
	labels,
}: {
	line: Extract<Line, { kind: "tool" }>;
	labels: LineLabels;
}) => {
	const elapsed = useElapsedSeconds(line.runningSince);
	const args = line.args ?? [];
	const output = line.output === "" ? undefined : line.output;
	const opens = args.length > 0 || output !== undefined;
	// A disclosure's summary may hold phrasing content only.
	const Row = opens ? "span" : "p";

	const head = (
		<Row className="flex min-w-0 flex-wrap items-baseline gap-x-2">
			<StatusGlyph status={line.status} />
			<span className="sr-only">{labels.tool}</span>
			<bdi className="font-bold">{line.label}</bdi>
			{line.detail !== undefined && (
				<code
					className="min-w-0 break-all text-muted-foreground"
					dir="ltr"
				>
					{line.detail}
				</code>
			)}
			<span className="sr-only">{labels.status(line.status)}</span>
			{elapsed !== undefined ? (
				<time
					aria-hidden="true"
					dateTime={`PT${elapsed}S`}
					className="text-muted-foreground tabular-nums"
				>
					{labels.duration(elapsed * 1_000)}
				</time>
			) : (
				line.durationMs !== undefined && (
					<span className="text-muted-foreground">
						{labels.duration(line.durationMs)}
					</span>
				)
			)}
			{opens && (
				<>
					<span
						aria-hidden="true"
						className="rtl:-scale-x-100 inline-block text-muted-foreground group-open:hidden"
					>
						▸
					</span>
					<span
						aria-hidden="true"
						className="hidden text-muted-foreground group-open:inline-block"
					>
						▾
					</span>
				</>
			)}
		</Row>
	);

	const size = line.outputLines !== undefined && (
		<Row className="flex flex-wrap items-baseline gap-x-2 ps-6 text-muted-foreground">
			<span aria-hidden="true" className="rtl:-scale-x-100 inline-block">
				↳
			</span>
			<span>{labels.outputLines(line.outputLines)}</span>
			{line.outputTruncated && (
				<span className="rounded-sm bg-muted px-1 text-foreground">
					{labels.truncated}
				</span>
			)}
		</Row>
	);

	const error = line.error !== undefined && (
		<p
			className="whitespace-pre-wrap break-words ps-6 text-destructive"
			dir="auto"
		>
			{line.error}
		</p>
	);

	if (!opens) {
		return (
			<div className="flex flex-col">
				{head}
				{size}
				{error}
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			<details className="group">
				<summary className="flex w-fit max-w-full cursor-pointer list-none flex-col rounded-sm focus-visible:outline-2 focus-visible:outline-foreground [&::-webkit-details-marker]:hidden">
					{head}
					{size}
				</summary>
				<div className="flex flex-col gap-2 py-1 ps-6">
					{args.length === 0 ? (
						<p className="text-muted-foreground">
							{labels.noArguments}
						</p>
					) : (
						<>
							<p className="text-muted-foreground">
								{labels.arguments}
							</p>
							<ArgumentList args={args} />
						</>
					)}
					{output !== undefined && (
						<>
							<p className="text-muted-foreground">
								{labels.output}
							</p>
							<pre
								dir="ltr"
								className="w-fit max-w-full whitespace-pre-wrap break-words"
							>
								{output}
							</pre>
						</>
					)}
				</div>
			</details>
			{error}
		</div>
	);
};

/** A subagent the run spawned: its status and name, then its result or error. */
const SubagentLineView = ({
	line,
	labels,
}: {
	line: Extract<Line, { kind: "subagent" }>;
	labels: LineLabels;
}) => (
	<div className="flex flex-col">
		<p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
			<StatusGlyph status={line.status} />
			<span className="sr-only">{labels.subagent}</span>
			<bdi className="font-bold">{line.label}</bdi>
			<span className="sr-only">{labels.status(line.status)}</span>
		</p>
		{line.resultPreview !== undefined && (
			<p
				className="whitespace-pre-wrap break-words ps-6 text-muted-foreground"
				dir="auto"
			>
				{line.resultPreview}
			</p>
		)}
		{line.error !== undefined && (
			<p
				className="whitespace-pre-wrap break-words ps-6 text-destructive"
				dir="auto"
			>
				{line.error}
			</p>
		)}
	</div>
);

/**
 * One transcript line.
 *
 * Text lines take their direction from their own words, so that a model's
 * English answer reads left to right in an Arabic console and an Arabic
 * prompt right to left in an English one. A prompt is a heading, so that a
 * screen reader's heading keys step from one turn to the next.
 */
const LineView = ({ line, labels }: { line: Line; labels: LineLabels }) => {
	switch (line.kind) {
		case "prompt":
			return (
				<h2
					className="whitespace-pre-wrap break-words font-semibold"
					dir="auto"
				>
					<span aria-hidden="true" className="text-muted-foreground">
						❯{" "}
					</span>
					{line.text}
				</h2>
			);
		case "text":
			return (
				<p className="whitespace-pre-wrap break-words" dir="auto">
					{line.segments.map((segment, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: a line's segments are rebuilt with it and never reordered, and have no id
						<SegmentView key={index} segment={segment} />
					))}
				</p>
			);
		case "reasoning":
			return (
				<details
					className="text-muted-foreground"
					open={!line.collapsed}
				>
					<summary className="w-fit cursor-pointer rounded-sm py-0.5 focus-visible:outline-2 focus-visible:outline-foreground">
						{labels.reasoning}
					</summary>
					<p
						className="whitespace-pre-wrap break-words ps-4"
						dir="auto"
					>
						{line.text}
					</p>
				</details>
			);
		case "tool":
			return <ToolLineView line={line} labels={labels} />;
		case "subagent":
			return <SubagentLineView line={line} labels={labels} />;
		case "divider":
			return line.label === undefined ? (
				<hr className="border-border" />
			) : (
				<p
					className={cn(
						"flex items-center gap-2",
						line.emphasis && EMPHASIS_CLASS[line.emphasis],
					)}
				>
					<span
						aria-hidden="true"
						className="h-px flex-1 bg-border"
					/>
					<span className="min-w-0 break-words text-center">
						{line.label}
					</span>
					<span
						aria-hidden="true"
						className="h-px flex-1 bg-border"
					/>
				</p>
			);
	}
};

/**
 * One session entry, as its lines.
 *
 * Memoised, because the session replaces only the entries a change touched:
 * a streaming run redraws itself, and every other entry is left alone. The
 * translate function and the labels change with the language, which redraws
 * every entry in it.
 *
 * @name EntryView
 * @param props.entry - The entry to draw.
 * @param props.translate - Translate for the lines agent-core writes.
 * @param props.labels - The transcript's own words, from useLineLabels.
 */
export const EntryView = memo(
	({
		entry,
		translate,
		labels,
	}: {
		entry: SessionEntry;
		translate: Translate;
		labels: LineLabels;
	}) => (
		<div
			className="flex flex-col gap-1"
			data-testid={`lineView-entry-${entry.id}`}
		>
			{entryLines(entry, translate, RUN_LINES_OPTIONS).map(
				(line, index) => (
					<LineView
						// An item has one line, and a run's items are only ever
						// appended, so a line keeps its index for as long as it is
						// shown. That matters for the disclosures, reasoning and
						// tool calls, which keep their own open state.
						// biome-ignore lint/suspicious/noArrayIndexKey: lines have no id, and the index is stable as described above
						key={index}
						line={line}
						labels={labels}
					/>
				),
			)}
		</div>
	),
);
