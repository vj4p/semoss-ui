import { CircleAlertIcon, SearchIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "@semoss/i18n";
import { useIteratorPixel } from "@semoss/sdk/react";
import {
	Alert,
	AlertDescription,
	AlertTitle,
	Button,
	H3,
	H4,
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	P,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Spinner,
	ToggleGroup,
	ToggleGroupItem,
	toast,
	useDebouncedValue,
	useInfiniteScroll,
	useTheme,
} from "@semoss/ui/next";
import { WorkspaceCard } from "@/components";
import { useChat, useGlobalBreadcrumbs, useRoot } from "@/hooks";
import type { App } from "@/types";
import {
	AGENT_FILTERS,
	type AgentFilter,
	buildCatalogPixel,
	isAgentFilter,
	isSortOption,
	PAGE_SIZE,
	SORT_OPTION_NAMES,
	type SortOption,
	toCardPermission,
} from "@/utility/workspace-catalog";

/**
 * Renders the WorkspacePage, allowing users to access their workspace or discover new ones
 *
 * @component
 */
export const WorkspacePage = observer(() => {
	const { t } = useTranslation(["workspace", "notifications", "common"]);
	const { root } = useRoot();
	const { theme: colorMode } = useTheme();

	const [filters, setFilters] = useState<AgentFilter[]>([]);
	const [sort, setSort] = useState<SortOption>("name");
	// set the breadcrumbs
	useGlobalBreadcrumbs({
		breadcrumbs: [
			{
				name: t("workspace:breadcrumbs.home"),
				path: "/",
			},
			{
				name: t("workspace:breadcrumbs.agent"),
				path: "/agent",
			},
		],
	});

	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search);
	const { chat } = useChat();

	/**
	 * Get all of the workspaces with lazy loading
	 */
	const getWorkspaces = useIteratorPixel<App[], App>(
		(limit, offset) =>
			buildCatalogPixel(filters, debouncedSearch, sort, limit, offset),
		(response) => {
			// if its less than the limit, we know its the end
			if (response.length < PAGE_SIZE) {
				return -1;
			}

			return Infinity;
		},
		(response) => {
			return response;
		},
		{
			limit: PAGE_SIZE,
		},
		[filters, debouncedSearch, sort],
	);

	/**
	 * Setup infinite scroll for the command list
	 */
	const { setScroll } = useInfiniteScroll({
		disabled: getWorkspaces.isLoading || !getWorkspaces.hasMore,
		onNext: () => {
			getWorkspaces.next();
		},
	});

	// theme == dark or system matches
	const isDark =
		colorMode === "dark" ||
		(colorMode === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);

	const src = isDark
		? root.theme.images.workspaceDark
		: root.theme.images.workspace;

	/** A search or a filter is narrowing the list. */
	const isFiltered = search.trim() !== "" || filters.length > 0;
	const clearFilters = () => {
		setSearch("");
		setFilters([]);
	};

	// shown in place of the list when nothing loaded, below it when a later page failed
	const loadError = getWorkspaces.isError ? (
		<Alert variant="destructive">
			<CircleAlertIcon aria-hidden="true" />
			<AlertTitle>{t("workspace:catalog.error.title")}</AlertTitle>
			<AlertDescription>
				<p>{t("workspace:catalog.error.description")}</p>
				<Button
					variant="outline"
					size="sm"
					className="mt-2"
					onClick={() => getWorkspaces.reset()}
				>
					{t("common:buttons.retry")}
				</Button>
			</AlertDescription>
		</Alert>
	) : null;

	return (
		<div
			ref={(el) => {
				if (el) setScroll(el);
			}}
			className="@container h-full w-full overflow-y-auto"
		>
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
				<div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
					<div className="min-w-0 flex-1">
						<H3>{t("workspace:catalog.title")}</H3>
						<P className="mt-2 max-w-prose font-medium text-muted-foreground">
							{t("workspace:catalog.description")}
						</P>
					</div>
					<Button asChild>
						<Link to="/agent/new">
							{t("workspace:actions.createAgent")}
						</Link>
					</Button>
					{src && (
						<img
							src={src}
							alt={t("workspace:images.agentIllustration")}
							className="max-h-32 w-full rounded-xl object-cover"
						/>
					)}
				</div>

				<div className="flex flex-col gap-4">
					<div className="flex @md:flex-row flex-col gap-2">
						<InputGroup className="flex-1 bg-background">
							<InputGroupInput
								aria-label={t("common:buttons.search")}
								placeholder={t("common:buttons.search")}
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
							<InputGroupAddon>
								<SearchIcon />
							</InputGroupAddon>
						</InputGroup>
						<Select
							value={sort}
							onValueChange={(value) => {
								if (isSortOption(value)) {
									setSort(value);
								}
							}}
						>
							<SelectTrigger
								aria-label={t("workspace:catalog.sort.label")}
								className="@md:w-48 w-full bg-background"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{SORT_OPTION_NAMES.map((option) => (
									<SelectItem key={option} value={option}>
										{t(`workspace:catalog.sort.${option}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<ToggleGroup
						type="multiple"
						variant="outline"
						size="sm"
						spacing={2}
						className="flex-wrap"
						aria-label={t("workspace:catalog.filters.label")}
						value={filters}
						onValueChange={(values) =>
							setFilters(values.filter(isAgentFilter))
						}
					>
						{AGENT_FILTERS.map((filter) => (
							<ToggleGroupItem key={filter} value={filter}>
								{t(`workspace:catalog.filters.${filter}`)}
							</ToggleGroupItem>
						))}
					</ToggleGroup>

					{getWorkspaces.isLoading &&
					getWorkspaces.data.length === 0 ? (
						<div className="flex items-center justify-center py-12">
							<Spinner />
						</div>
					) : getWorkspaces.data.length === 0 ? (
						// a failed fetch is not "no agents": say so and offer a retry
						(loadError ?? (
							<output className="flex flex-col items-center gap-2 px-2 py-12 text-center">
								<H4>
									{isFiltered
										? t(
												"workspace:catalog.filteredEmpty.title",
											)
										: t("workspace:catalog.empty.title")}
								</H4>
								<P className="max-w-prose text-muted-foreground text-sm">
									{isFiltered
										? t(
												"workspace:catalog.filteredEmpty.description",
											)
										: t(
												"workspace:catalog.empty.description",
											)}
								</P>
								<div className="mt-2 flex flex-wrap items-center justify-center gap-2">
									{isFiltered ? (
										<Button
											variant="outline"
											size="sm"
											onClick={clearFilters}
										>
											{t(
												"workspace:catalog.clearFilters",
											)}
										</Button>
									) : (
										<Button
											variant="outline"
											size="sm"
											asChild
										>
											<Link to="/agent/new">
												{t(
													"workspace:actions.createAgent",
												)}
											</Link>
										</Button>
									)}
								</div>
							</output>
						))
					) : (
						<div className="grid @2xl:grid-cols-2 @3xl:grid-cols-3 grid-cols-1 gap-4">
							{getWorkspaces.data.map((w) => (
								<WorkspaceCard
									key={w.project_id}
									workspace={{
										workspace_id: w.project_id,
										name:
											w.project_display_name ||
											w.project_name,
										description: w.description ?? "",
									}}
									permission={toCardPermission(w)}
									dateCreated={w.project_date_created}
									onDeleteClick={async () => {
										try {
											await chat.deleteWorkspace(
												w.project_id,
											);

											getWorkspaces.reset();
										} catch (e) {
											toast.error(
												e instanceof Error
													? e.message
													: t(
															"notifications:workspace.deleteError",
														),
											);
										}
									}}
								/>
							))}
						</div>
					)}

					{/* a later page failed: the agents already loaded stay */}
					{getWorkspaces.data.length > 0 ? loadError : null}

					{getWorkspaces.isLoading &&
						getWorkspaces.data.length > 0 && (
							<div className="flex items-center justify-center p-4">
								<Spinner className="size-4" />
							</div>
						)}
				</div>
			</div>
		</div>
	);
});
