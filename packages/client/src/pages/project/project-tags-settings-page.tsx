import {
	buildProjectMetaValuesPixel,
	buildSetProjectMetadataPixel,
} from "@/api/catalog-meta";
import { CatalogTagsSettings } from "@/components/catalog";
import { useConfig, useProject, useSession } from "@/hooks";

/** Settings section for a project's tags, classification, and domain. */
export const ProjectTagsSettingsPage = () => {
	const { project, permission, refresh, catalog } = useProject();
	const projectMetaKeys = useConfig((state) => state.config.projectMetaKeys);
	const runPixel = useSession((state) => state.runPixel);

	return (
		<CatalogTagsSettings
			metadata={project as unknown as Record<string, unknown>}
			permission={permission}
			buildMetaValuesPixel={buildProjectMetaValuesPixel}
			metaKeysConfig={projectMetaKeys}
			onSave={async (meta) => {
				const response = await runPixel(
					buildSetProjectMetadataPixel(project.project_id, meta),
				);
				if (response.errors.length > 0) {
					throw new Error(response.errors.join(""));
				}
			}}
			onUpdated={refresh}
			description={`Organize and classify this ${catalog.name.toLowerCase()} across the catalog.`}
			testIdPrefix="project-tags-settings"
		/>
	);
};
