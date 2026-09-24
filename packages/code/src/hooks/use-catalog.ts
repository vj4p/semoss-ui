import { useEffect, useMemo, useState } from "react";
import {
	describeError,
	type ModelOption,
	type SessionCatalog,
} from "@semoss/agent-core";
import { type AgentHarnessFallback, useAgentHarnesses } from "@semoss/shared";
import { getDefaultModelId, getTextGenerationModels } from "@/api";

/**
 * No harness is offered when the backend cannot list them. A stale guess
 * would only fail at run time, and a prompt with no harness says why it was
 * not sent. A module constant, because the hook recomputes its list whenever
 * the fallback's identity changes.
 */
const NO_FALLBACK: readonly AgentHarnessFallback[] = [];

/**
 * What a session starts with: the harnesses and models to choose from, and
 * the user's default model.
 *
 * Ready only once both lists have loaded, so that a session never starts on
 * a harness or model the user did not pick just because the other list came
 * in first. The models failing to load is an error; the harnesses failing is
 * not, because `useAgentHarnesses` treats it as an empty list, which the
 * status bar shows as "none".
 *
 * The catalog it returns can change identity with nothing in it changing,
 * each time the harness hook's translation function does. A consumer should
 * not recreate anything on that alone.
 *
 * @name useCatalog
 * @param insightId - Insight the pixels execute against.
 * @return Loading, failed with a message, or ready with the catalog.
 */
export const useCatalog = (
	insightId: string,
):
	| { status: "loading" }
	| { status: "failed"; message: string }
	| { status: "ready"; catalog: SessionCatalog; defaultModelId?: string } => {
	const { harnesses, loading } = useAgentHarnesses({
		fallback: NO_FALLBACK,
		insightId,
	});
	const [models, setModels] = useState<
		| { status: "loading" }
		| { status: "failed"; message: string }
		| { status: "ready"; list: ModelOption[]; defaultModelId?: string }
	>({ status: "loading" });

	useEffect(() => {
		let cancelled = false;
		setModels({ status: "loading" });
		Promise.all([
			getTextGenerationModels(insightId),
			// A default that cannot be read is no reason not to start: the
			// session starts on the first model instead.
			getDefaultModelId(insightId).catch(() => undefined),
		]).then(
			([list, defaultModelId]) => {
				if (!cancelled) {
					setModels({ status: "ready", list, defaultModelId });
				}
			},
			(error: unknown) => {
				if (!cancelled) {
					setModels({
						status: "failed",
						message: describeError(error),
					});
				}
			},
		);
		return () => {
			cancelled = true;
		};
	}, [insightId]);

	return useMemo(() => {
		if (models.status === "failed") {
			return models;
		}
		if (loading || models.status === "loading") {
			return { status: "loading" };
		}
		return {
			status: "ready",
			catalog: { harnesses, models: models.list },
			defaultModelId: models.defaultModelId,
		};
	}, [harnesses, loading, models]);
};
