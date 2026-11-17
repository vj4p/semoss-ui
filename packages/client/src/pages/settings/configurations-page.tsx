import { Search } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Navigate } from "react-router";
import { MonacoEditor } from "@semoss/shared";
import {
	Button,
	Input,
	Spinner,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@semoss/ui/next";
import { isRecord } from "@semoss/utility/object";
import { formatToDataTestId } from "@semoss/utility/text";
import dropbox from "@/assets/img/DROPBOX.png";
import github from "@/assets/img/GITHUB.svg";
import google from "@/assets/img/GOOGLE.svg";
import ms from "@/assets/img/ms.png";
import other from "@/assets/img/other.png";
import { CatalogLoadError } from "@/components/catalog/catalog-load-error";
import { SocialPropertyForm } from "@/features/login-properties/social-property-form";
import { PlatformDefaultCard } from "@/features/platform-default-limit/platform-default-card";
import { useAPI, useSettings } from "@/hooks";
import { type FieldProps, toField } from "./configuration-secrets";

/** Each login provider's properties as the page edits them, by provider key */
type SocialProps = Record<string, FieldProps[]>;

const SOCIAL = {
	google: {
		name: "Google",
		image: google,
	},
	ms: {
		name: "Microsoft",
		image: ms,
	},
	dropbox: {
		name: "Dropbox",
		image: dropbox,
	},
	github: {
		name: "Github",
		image: github,
	},
	native: {
		name: "Native",
		image: other,
	},
};

/**
 * Turn the server's login properties into the fields the page edits. Anything
 * that is not properties by provider is skipped rather than trusted.
 *
 * @param data - What `getLoginProperties` returned.
 * @returns The fields by provider, without the CAC provider (it has no settings here).
 */
const toSocialProps = (data: unknown): SocialProps => {
	const formatted: SocialProps = {};
	if (!isRecord(data)) {
		return formatted;
	}
	for (const [provider, properties] of Object.entries(data)) {
		if (provider === "cac" || !isRecord(properties)) {
			continue;
		}
		formatted[provider] = Object.entries(properties).map(([label, value]) =>
			toField(label, value),
		);
	}
	return formatted;
};

export const ConfigurationsPage = () => {
	const { adminMode } = useSettings();
	const [socialProps, setSocialProps] = useState<SocialProps>({});
	const [accordionValue, setAccordionValue] = useState<string>();
	const [tabValue, setTabValue] = useState("settings");
	const [authSearch, setAuthSearch] = useState("");

	const loginProperties = useAPI(["getLoginProperties"]);

	// a fresh read (the first one, or after Reset) replaces what was edited
	useEffect(() => {
		if (loginProperties.status !== "SUCCESS" || !loginProperties.data) {
			return;
		}
		const formatted = toSocialProps(loginProperties.data);
		setSocialProps(formatted);
		setAccordionValue((current) =>
			current && formatted[current] ? current : Object.keys(formatted)[0],
		);
	}, [loginProperties.status, loginProperties.data]);

	if (!adminMode) {
		return <Navigate to="/settings" />;
	}

	// only the Settings tab waits for the login properties
	const isLoadingLoginProperties = loginProperties.status !== "SUCCESS";

	const search = authSearch.trim().toLowerCase();
	const authentication = Object.keys(socialProps).filter((provider) =>
		provider.toLowerCase().includes(search),
	);

	const updateField = (provider: string, index: number, value: string) => {
		setSocialProps((current) => ({
			...current,
			[provider]: current[provider].map((field, i) =>
				i === index ? { ...field, value } : field,
			),
		}));
	};

	const settingsPage = () => {
		return (
			<div className="flex flex-col gap-4 md:flex-row md:gap-0">
				{/* Left nav, stacked above the properties on narrow screens */}
				<div className="w-full md:w-[291px] md:shrink-0">
					<div className="rounded-md border">
						<p className="px-4 py-3 font-medium text-sm">
							Authentication
						</p>
						<div className="border-t px-3 pt-2 pb-3">
							<div className="relative">
								<Search
									className="-translate-y-1/2 absolute top-1/2 left-2 size-4 text-muted-foreground"
									aria-hidden
								/>
								<Input
									className="h-8 pl-8 text-sm"
									value={authSearch}
									onChange={(e) =>
										setAuthSearch(e.target.value)
									}
									placeholder="Search..."
									aria-label="Search sign-in providers"
								/>
							</div>
						</div>
						{/* bounded on phones so the properties start right after it, in full from md up */}
						<nav
							aria-label="Sign-in providers"
							className="flex max-h-60 flex-col overflow-y-auto pb-2 md:max-h-none md:overflow-visible"
						>
							{authentication.map((value) => (
								<div key={value} className="px-4 py-1 text-sm">
									<Button
										variant="ghost"
										className="w-full justify-start font-normal"
										onClick={() => {
											setAccordionValue(value);
										}}
										data-testid={formatToDataTestId(
											`configurationPage-auth-${value}-btn`,
										)}
									>
										<img
											src={
												SOCIAL[value]?.image ||
												SOCIAL.native.image
											}
											alt=""
											className="mr-2 max-h-7 max-w-7 object-cover p-1 align-middle"
										/>
										{SOCIAL[value]?.name ||
											value[0].toUpperCase() +
												value.slice(1)}
									</Button>
								</div>
							))}
						</nav>
					</div>
				</div>
				{/* Right panel */}
				{accordionValue && socialProps[accordionValue] ? (
					<SocialPropertyForm
						key={accordionValue}
						provider={accordionValue}
						fields={socialProps[accordionValue]}
						onFieldChange={(index, value) =>
							updateField(accordionValue, index, value)
						}
						onReset={loginProperties.refresh}
					/>
				) : null}
			</div>
		);
	};

	const fileContentsPage = () => {
		const defaultTyping = ``;
		return (
			<div className="mb-4 flex flex-col rounded-[15px] border border-border bg-card p-6 text-card-foreground shadow-sm">
				<div className="mb-2 flex justify-between">
					<h2 className="font-semibold text-xl">social.properties</h2>
					<div className="flex justify-center gap-2">
						<Button
							variant="outline"
							className="font-bold"
							data-testid="configurationPage-social-prop-reset-btn"
						>
							Reset
						</Button>
						<Button
							className="font-bold"
							data-testid="configurationPage-social-prop-save-btn"
						>
							Save
						</Button>
					</div>
				</div>
				<hr className="mb-2" />
				<Suspense fallback={<>...</>}>
					<MonacoEditor
						height="60vh"
						defaultLanguage="javascript"
						defaultValue={defaultTyping}
					/>
				</Suspense>
			</div>
		);
	};

	const customTogglePanel = (
		children: React.ReactNode,
		index: string,
		value: string,
	) => {
		return (
			<div hidden={value !== index}>
				{value === index && <div>{children}</div>}
			</div>
		);
	};

	return (
		<div>
			<Tabs value={tabValue} onValueChange={setTabValue} className="mb-4">
				<TabsList>
					<TabsTrigger value="settings">Settings</TabsTrigger>
					<TabsTrigger value="usage-limits">Usage Limits</TabsTrigger>
					<TabsTrigger value="file-contents" disabled>
						File Contents
					</TabsTrigger>
				</TabsList>
			</Tabs>
			{customTogglePanel(
				loginProperties.status === "ERROR" ? (
					<CatalogLoadError
						noun="sign-in settings"
						onRetry={loginProperties.refresh}
					/>
				) : isLoadingLoginProperties ? (
					<div className="flex items-center justify-center gap-2 py-10">
						<Spinner className="size-6" />
						<span className="text-muted-foreground text-sm">
							Retrieving social properties
						</span>
					</div>
				) : (
					settingsPage()
				),
				"settings",
				tabValue,
			)}
			{customTogglePanel(
				<PlatformDefaultCard />,
				"usage-limits",
				tabValue,
			)}
			{customTogglePanel(fileContentsPage(), "file-contents", tabValue)}
		</div>
	);
};
