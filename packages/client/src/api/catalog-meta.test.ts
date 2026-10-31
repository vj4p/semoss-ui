import { describe, expect, it } from "vitest";
import {
	buildDatabaseMetaValuesPixel,
	buildEngineFilterValuesPixel,
	buildProjectFilterValuesPixel,
	buildProjectMetaValuesPixel,
	buildSetEngineMetadataPixel,
	buildSetProjectMetadataPixel,
} from "./catalog-meta";

describe("catalog metadata Pixel", () => {
	it("sets an app's metadata", () => {
		expect(
			buildSetProjectMetadataPixel("abc-123", {
				tag: ["a", "b"],
				description: "Hello",
			}),
		).toBe(
			'SetProjectMetadata(project=["abc-123"], meta=[{"tag":["a","b"],"description":"Hello"}]);',
		);
	});

	it("sets an engine's metadata", () => {
		expect(
			buildSetEngineMetadataPixel("eng-1", { description: "Docs" }),
		).toBe(
			'SetEngineMetadata(engine=["eng-1"], meta=[{"description":"Docs"}]);',
		);
	});

	it("lists the values used for meta keys", () => {
		expect(buildProjectMetaValuesPixel(["tag"])).toBe(
			'META | GetProjectMetaValues ( metaKeys = ["tag"] ) ;',
		);
		expect(buildDatabaseMetaValuesPixel(["tag", "domain"])).toBe(
			'META | GetDatabaseMetaValues ( metaKeys = ["tag","domain"] ) ;',
		);
	});

	it("lists a catalog's filter values with their counts", () => {
		expect(
			buildProjectFilterValuesPixel(["INSIGHT", "SKILL"], ["tag"]),
		).toBe(
			'GetProjectMetaValues(projectType=["INSIGHT","SKILL"], metaKeys=["tag"]);',
		);
		expect(buildEngineFilterValuesPixel("MODEL", ["tag", "domain"])).toBe(
			'GetEngineMetaValues(engineTypes=["MODEL"], metaKeys=["tag","domain"]);',
		);
	});

	it("keeps a quote or backslash in an id inside its literal", () => {
		const pixel = buildSetProjectMetadataPixel('a"], meta=[{}]); X("b\\', {
			tag: [],
		});

		expect(pixel).toBe(
			'SetProjectMetadata(project=["a\\"], meta=[{}]); X(\\"b\\\\"], meta=[{"tag":[]}]);',
		);
		// the id is still one literal: no unescaped quote ends it early
		const id = pixel.slice(
			pixel.indexOf('["') + 1,
			pixel.indexOf('], meta=[{"tag"'),
		);
		expect(JSON.parse(id)).toBe('a"], meta=[{}]); X("b\\');
	});

	it("escapes a type and meta keys too", () => {
		expect(buildEngineFilterValuesPixel('M"x', ['k"1'])).toBe(
			'GetEngineMetaValues(engineTypes=["M\\"x"], metaKeys=["k\\"1"]);',
		);
	});
});
