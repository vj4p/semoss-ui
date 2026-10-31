import { describe, expect, it } from "vitest";
import {
	buildCloneSkillPixel,
	buildCreateAppFromTemplatePixel,
} from "./project-clone";

describe("project clone Pixel", () => {
	it("clones a skill", () => {
		expect(buildCloneSkillPixel("skill-1", "My copy")).toBe(
			'CloneSkill(skillId=["skill-1"], name=["My copy"]);',
		);
	});

	it("creates an app from a template", () => {
		expect(buildCreateAppFromTemplatePixel("My app", "tpl-1", false)).toBe(
			'CreateAppFromTemplate(project=["My app"], projectTemplate=["tpl-1"], global=["false"]);',
		);
		expect(buildCreateAppFromTemplatePixel("My app", "tpl-1", true)).toBe(
			'CreateAppFromTemplate(project=["My app"], projectTemplate=["tpl-1"], global=["true"]);',
		);
	});

	it("keeps a quote, backslash or apostrophe in a typed name inside its literal", () => {
		expect(buildCloneSkillPixel("s", 'a "q" \\ b')).toBe(
			'CloneSkill(skillId=["s"], name=["a \\"q\\" \\\\ b"]);',
		);
		expect(buildCreateAppFromTemplatePixel("Bob's app", "t", false)).toBe(
			'CreateAppFromTemplate(project=["Bob\'s app"], projectTemplate=["t"], global=["false"]);',
		);
	});
});
