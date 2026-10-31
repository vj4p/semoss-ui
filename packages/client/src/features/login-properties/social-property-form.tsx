import { type FormEvent, useState } from "react";
import {
	Alert,
	AlertDescription,
	Button,
	H3,
	Input,
	Label,
	Spinner,
	toast,
} from "@semoss/ui/next";
import { getErrorMessage } from "@semoss/utility/error";
import { modifyLoginProperties } from "@/api";
import {
	type FieldProps,
	getInputValue,
	isMasked,
	isSecretField,
	nextFieldValue,
	toPropertyValues,
} from "@/pages/settings/configuration-secrets";

export interface SocialPropertyFormProps {
	/** The login provider's key, such as "google" */
	provider: string;
	/** The provider's properties as the page holds them */
	fields: FieldProps[];
	/** A property's input changed */
	onFieldChange: (index: number, value: string) => void;
	/** Throw away unsaved edits by reading the saved values again */
	onReset: () => void;
}

/**
 * Edits one login provider's properties and saves them together. A secret that
 * is already set shows an empty input with a "Set" hint and is kept when left
 * blank. A failed save stays on screen with the edits intact. Mount it with a
 * key per provider so the saving state does not follow the person to another.
 */
export const SocialPropertyForm = ({
	provider,
	fields,
	onFieldChange,
	onReset,
}: SocialPropertyFormProps) => {
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const title = provider.charAt(0).toUpperCase() + provider.slice(1);

	const handleSubmit = async (
		event: FormEvent<HTMLFormElement>,
	): Promise<void> => {
		event.preventDefault();
		if (isSaving) {
			return;
		}
		setIsSaving(true);
		setSaveError(null);
		try {
			await modifyLoginProperties(provider, toPropertyValues(fields));
		} catch (error: unknown) {
			setSaveError(
				getErrorMessage(
					error,
					`Could not save the ${title} properties`,
				),
			);
			setIsSaving(false);
			return;
		}
		setIsSaving(false);
		toast.success(`Successfully modified ${provider} properties`);
	};

	return (
		<form
			className="w-full min-w-0 md:ml-8"
			onSubmit={handleSubmit}
			aria-busy={isSaving}
		>
			<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
				<H3 className="text-xl">{title}</H3>
				<div className="flex justify-center gap-2">
					<Button
						type="button"
						variant="outline"
						disabled={isSaving}
						onClick={onReset}
						data-testid="configurationPage-reset-btn"
					>
						Reset
					</Button>
					<Button
						type="submit"
						disabled={isSaving}
						data-testid="configurationPage-save-btn"
					>
						{isSaving ? <Spinner className="size-4" /> : null}
						Save
					</Button>
				</div>
			</div>
			{saveError ? (
				<Alert variant="destructive" className="mb-4">
					<AlertDescription>{saveError}</AlertDescription>
				</Alert>
			) : null}
			<div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card text-card-foreground">
				{fields.map((field, index) => {
					const inputId = `${provider}-${field.label}-value`;
					return (
						<div
							key={`${provider}-${field.label}`}
							className="grid gap-2 px-4 py-3 md:grid-cols-5 md:items-center md:gap-4"
						>
							<Label
								htmlFor={inputId}
								className="break-all font-mono text-sm md:col-span-2"
							>
								{field.label}
							</Label>
							<Input
								className="md:col-span-3"
								id={inputId}
								type={
									isSecretField(field) ? "password" : "text"
								}
								autoComplete="off"
								disabled={isSaving}
								value={getInputValue(field)}
								placeholder={
									isMasked(field)
										? "Set. Type a new value to replace it."
										: undefined
								}
								onChange={(event) =>
									// emptying a secret that is set keeps it: the marker
									// tells the server it is unchanged
									onFieldChange(
										index,
										nextFieldValue(
											field,
											event.target.value,
										),
									)
								}
							/>
						</div>
					);
				})}
			</div>
		</form>
	);
};
