// biome-ignore-all lint/correctness/useExhaustiveDependencies: TODO

import { Search } from "lucide-react";
import type React from "react";
import { Suspense, useEffect, useReducer, useRef, useState } from "react";
import { MonacoEditor } from "@semoss/shared";
import {
	Button,
	H3,
	Input,
	Label,
	Spinner,
	Tabs,
	TabsList,
	TabsTrigger,
	toast,
} from "@semoss/ui/next";
import { formatToDataTestId } from "@semoss/utility/text";
import { modifyLoginProperties } from "@/api";
import dropbox from "@/assets/img/DROPBOX.png";
import github from "@/assets/img/GITHUB.svg";
import google from "@/assets/img/GOOGLE.svg";
import ms from "@/assets/img/ms.png";
import other from "@/assets/img/other.png";
import { useAPI, useSettings } from "@/hooks";
import { useNavigate } from "@/hooks/useNavigate";
import {
	type FieldProps,
	getInputValue,
	isMasked,
	isSecretField,
	nextFieldValue,
	toField,
	toPropertyValues,
} from "./configuration-secrets";

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

const initialState = {
	socialProps: {},
};

const reducer = (state, action) => {
	switch (action.type) {
		case "field": {
			return {
				...state,
				[action.field]: action.value,
			};
		}
	}
	return state;
};

export const ConfigurationsPage = () => {
	const { adminMode } = useSettings();

	const navigate = useNavigate();

	if (!adminMode) {
		navigate("/settings");
	}

	const [state, dispatch] = useReducer(reducer, initialState);
	const { socialProps } = state;

	const [accordionValue, setAccordionValue] = useState<string>();
	const [authentication, setAuthentication] = useState(
		Object.keys(socialProps),
	);
	const [tabValue, setTabValue] = useState("settings");
	const [authSearch, setAuthSearch] = useState("");
	const authSearchBarRef = useRef(null);

	const loginProperties = useAPI(["getLoginProperties"]);

	useEffect(() => {
		if (loginProperties.status !== "SUCCESS" || !loginProperties.data) {
			return;
		}

		const formattedProperties = {};
		Object.entries(loginProperties.data).forEach((pr) => {
			if (pr[0] === "cac") return;
			const fields: FieldProps[] = [];
			Object.entries(pr[1]).forEach((prop) => {
				fields.push(toField(prop[0], prop[1]));
			});

			if (!formattedProperties[pr[0]]) {
				formattedProperties[pr[0]] = fields;
			}
		});

		dispatch({
			type: "field",
			field: "socialProps",
			value: formattedProperties,
		});

		if (!accordionValue) {
			setAccordionValue(Object.keys(formattedProperties)[0]);
		}
		setAuthentication(Object.keys(formattedProperties));
		authSearchBarRef.current?.focus();
	}, [loginProperties.status, loginProperties.data]);

	useEffect(() => {
		if (!authSearch) {
			setAuthentication(Object.keys(socialProps));
			return;
		}

		const cleanedSearch = authSearch.toLowerCase();
		const filtered = authentication.filter((c) => {
			return c.toLowerCase().includes(cleanedSearch);
		});

		setAuthentication(filtered);
	}, [authSearch]);

	if (loginProperties.status !== "SUCCESS" || !Object.keys(socialProps)) {
		return (
			<div className="flex h-full items-center justify-center gap-2">
				<Spinner className="size-6" />
				<span className="text-muted-foreground text-sm">
					Retrieving social properties
				</span>
			</div>
		);
	}

	const updateSocialProps = (
		fieldName: string,
		value: string,
		_label: string,
		index,
	) => {
		const socialPropsCopy = socialProps;
		socialPropsCopy[fieldName][index].value = value;
		dispatch({
			type: "field",
			field: "socialProps",
			value: socialPropsCopy,
		});
	};

	const resetLoginProperties = () => {
		loginProperties.refresh();
	};

	const settingsPage = () => {
		return Object.keys(socialProps) ? (
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
									ref={authSearchBarRef}
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
						<div className="flex flex-col pb-2">
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
						</div>
					</div>
				</div>
				{/* Right panel */}
				{accordionValue && (
					<SocialProperty
						key={authentication.indexOf(accordionValue)}
						fieldName={accordionValue}
						fields={socialProps[accordionValue]}
						updateSocialProps={updateSocialProps}
						resetLoginProperties={resetLoginProperties}
					/>
				)}
			</div>
		) : (
			<div>No socials props</div>
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
					<TabsTrigger value="file-contents" disabled>
						File Contents
					</TabsTrigger>
				</TabsList>
			</Tabs>
			{customTogglePanel(settingsPage(), "settings", tabValue)}
			{customTogglePanel(fileContentsPage(), "file-contents", tabValue)}
		</div>
	);
};

const SocialProperty = (props) => {
	const { fieldName, fields, resetLoginProperties, updateSocialProps } =
		props;

	const onSubmit = () => {
		const values = toPropertyValues(fields);
		modifyLoginProperties(fieldName, values).then(() => {
			toast.success(`Successfully modified ${fieldName} properties`);
		});
	};

	return (
		<form className="w-full min-w-0 md:ml-8">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
				<H3 className="text-xl">
					{fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}
				</H3>
				<div className="flex justify-center gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => resetLoginProperties(fieldName)}
						data-testid="configurationPage-reset-btn"
					>
						Reset
					</Button>
					<Button
						type="button"
						onClick={() => onSubmit()}
						data-testid="configurationPage-save-btn"
					>
						Save
					</Button>
				</div>
			</div>
			<div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card text-card-foreground">
				{fields.map((f, i) => {
					const inputId = `${fieldName}-${f.label}-value`;
					return (
						<div
							key={`${fieldName}-${f.label}`}
							className="grid gap-2 px-4 py-3 md:grid-cols-5 md:items-center md:gap-4"
						>
							<Label
								htmlFor={inputId}
								className="break-all font-mono text-sm md:col-span-2"
							>
								{f.label}
							</Label>
							<Input
								className="md:col-span-3"
								id={inputId}
								type={isSecretField(f) ? "password" : "text"}
								autoComplete="off"
								value={getInputValue(f)}
								placeholder={
									isMasked(f)
										? "Set. Type a new value to replace it."
										: undefined
								}
								onChange={(e) => {
									// emptying a secret that is set keeps it,
									// the marker tells the server it is unchanged
									updateSocialProps(
										fieldName,
										nextFieldValue(f, e.target.value),
										f.label,
										i,
									);
								}}
							/>
						</div>
					);
				})}
			</div>
		</form>
	);
};
