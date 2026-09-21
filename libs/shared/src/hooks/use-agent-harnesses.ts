import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@semoss/i18n";
import { type AgentHarnessDescriptor, getAgentHarnesses } from "@semoss/sdk";

/**
 * A harness a caller offers when the backend cannot be reached.
 *
 * `label` exists because not every app loads the `room` i18n namespace - the
 * client's agent form never has - so without it a fallback render would show the
 * raw registry key.
 */
export interface AgentHarnessFallback {
	name: string;
	label?: string;
}

/**
 * A harness as a picker needs it: identity from the backend, wording preferring
 * the translated copy.
 */
export interface AgentHarnessOption {
	/** Registry key, and the value `RunAgent` expects as `harnessType`. */
	name: string;
	/** Translated label when one exists, else the backend's display name. */
	label: string;
	/** Translated description when one exists, else the backend's. */
	description: string;
	/** True for the harness used when none is requested. */
	isDefault: boolean;
}

/**
 * The harnesses a picker should offer, newest source of truth first.
 *
 * <p>The list comes from `GetAgentHarnesses`, which reads
 * `AgentHarnessRegistry`. It is not compiled in because a deployment can
 * register its own harness at startup, and because the same list had been
 * hardcoded in several packages that then drifted apart.
 *
 * <h4>Why two sources of wording, deliberately</h4>
 *
 * Labels prefer i18n and fall back to the backend. That is not redundancy: i18n
 * can translate, but only knows the harnesses that shipped with the build, while
 * the backend knows every registered harness including ones i18n has never heard
 * of. Preferring the translation keeps shipped harnesses localized; the fallback
 * keeps a custom harness readable instead of blank.
 *
 * <h4>Failure behaviour</h4>
 *
 * A picker with no options is worse than a stale one, so a failed call falls back
 * to `fallback` rather than rendering empty. The backend validates `harnessType`
 * on every run regardless, so a stale entry fails loudly at run time rather than
 * silently doing the wrong thing.
 *
 * @param options.fallback   harness names to offer if the call fails
 * @param options.insightId  optional insight to run the pixel against
 * @return the options, plus whether the fetch is still in flight
 */
export const useAgentHarnesses = ({
	fallback = [],
	insightId,
}: {
	fallback?: readonly AgentHarnessFallback[];
	insightId?: string;
} = {}): { harnesses: AgentHarnessOption[]; loading: boolean } => {
	const { t } = useTranslation("room");
	const [descriptors, setDescriptors] = useState<
		AgentHarnessDescriptor[] | null
	>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const result = await getAgentHarnesses(insightId);
				if (!cancelled) {
					setDescriptors(result);
				}
			} catch (e) {
				// Non-fatal: the fallback below still yields a usable picker.
				console.error(
					"Could not read the available agent harnesses",
					e,
				);
				if (!cancelled) {
					setDescriptors(null);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [insightId]);

	const harnesses = useMemo<AgentHarnessOption[]>(() => {
		// Compare against the key rather than asking the i18n instance: i18next
		// returns the key itself when there is no translation, and that holds
		// whether the namespace is loaded, missing, or the whole thing is a test
		// double. Calling i18n.exists() assumed a shape that a mocked
		// useTranslation does not have, which broke the client's tests.
		const translated = (name: string, field: "label" | "description") => {
			const key = `room:harness.types.${name}.${field}`;
			const value = t(key);
			return value === key ? "" : value;
		};

		const labelled = (name: string) =>
			fallback.find((f) => f.name === name)?.label;

		if (descriptors) {
			return (
				descriptors
					// Registered does not mean offered - the backend decides.
					// Compare against false rather than truthiness: a backend predating
					// isSelectable omits the field, and treating undefined as "hide"
					// would empty the picker against every older server.
					.filter((d) => d.isSelectable !== false)
					.map((d) => ({
						name: d.name,
						label:
							translated(d.name, "label") ||
							d.displayName ||
							labelled(d.name) ||
							d.name,
						description:
							translated(d.name, "description") || d.description,
						isDefault: d.isDefault,
					}))
			);
		}

		return fallback.map((f) => ({
			name: f.name,
			label: translated(f.name, "label") || f.label || f.name,
			description: translated(f.name, "description"),
			isDefault: false,
		}));
	}, [descriptors, fallback, t]);

	return { harnesses, loading };
};
