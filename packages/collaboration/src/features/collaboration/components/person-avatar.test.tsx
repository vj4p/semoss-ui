import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PersonAvatar } from "./person-avatar";

const NAMES = [
	"Omar Haddad",
	"Vijay Bhagwati",
	"Maya Chen",
	"Priya Nair",
	"Ben Okafor",
	"Weekly Digest",
	"Local Tester",
	"A B",
];

describe("PersonAvatar", () => {
	it("never sets the initials in a chart color, which fails contrast on its own tint", () => {
		for (const name of NAMES) {
			const html = renderToStaticMarkup(<PersonAvatar name={name} />);
			expect(html).not.toMatch(/text-chart-/);
			expect(html).toContain("text-foreground");
		}
	});

	it("tints the background by name, and the same name always gets the same tint", () => {
		const tint = (name: string) =>
			renderToStaticMarkup(<PersonAvatar name={name} />).match(
				/bg-(?:chart-\d|primary)\/10/,
			)?.[0];
		expect(tint("Maya Chen")).toBeDefined();
		expect(tint("Maya Chen")).toBe(tint("Maya Chen"));
		expect(new Set(NAMES.map(tint)).size).toBeGreaterThan(1);
	});

	it("takes initials from the first two words unless told", () => {
		expect(
			renderToStaticMarkup(<PersonAvatar name="maya chen lee" />),
		).toContain(">MC<");
		expect(
			renderToStaticMarkup(
				<PersonAvatar name="Maya Chen" initials="XY" />,
			),
		).toContain(">XY<");
	});

	it("lets a caller replace the tint", () => {
		expect(
			renderToStaticMarkup(
				<PersonAvatar
					name="Maya Chen"
					tone="bg-primary/10 text-primary-text"
				/>,
			),
		).toContain("text-primary-text");
	});
});
