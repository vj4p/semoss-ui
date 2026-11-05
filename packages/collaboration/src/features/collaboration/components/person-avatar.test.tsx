import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
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
	afterEach(cleanup);

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

	it("covers the initials with the person's Microsoft photo", () => {
		const { container } = render(
			<PersonAvatar name="Ana Ruiz" email="ana+work@test.com" />,
		);
		const photo = container.querySelector("img");
		expect(photo?.getAttribute("src")).toMatch(
			/\/msgraph\/photo\?email=ana%2Bwork%40test\.com$/,
		);
		expect(photo?.getAttribute("alt")).toBe("");
		expect(photo?.getAttribute("loading")).toBe("lazy");
		expect(container.textContent).toBe("AR");
	});

	it("keeps the initials when there is no photo to show", () => {
		const { container } = render(
			<PersonAvatar name="Ana Ruiz" email="ana@test.com" />,
		);
		const photo = container.querySelector("img");
		if (!photo) throw new Error("Expected the avatar to ask for a photo");
		fireEvent.error(photo);
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toBe("AR");
	});

	it("asks for no photo without an address", () => {
		const { container } = render(
			<PersonAvatar name="Ana Ruiz" email={null} />,
		);
		expect(container.querySelector("img")).toBeNull();
		expect(container.textContent).toBe("AR");
	});
});
