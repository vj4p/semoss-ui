import { expect, test } from "@playwright/test";

test.describe("MCP Tools Overlay E2E", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to code terminal
		await page.goto("http://localhost:9090/packages/code/dist/");

		// Login if needed
		const needsLogin = await page
			.locator('input[type="password"]')
			.isVisible()
			.catch(() => false);

		if (needsLogin) {
			await page.fill('input[name="username"]', "testuser");
			await page.fill('input[type="password"]', "testpass");
			await page.click('button:has-text("Login")');
			await page.waitForURL(/packages\/code\/dist/);
		}
	});

	test("opens MCP overlay with :mcp command", async ({ page }) => {
		// Type :mcp command
		const input = page.locator('textarea, input[type="text"]').last();
		await input.fill(":mcp");
		await page.keyboard.press("Enter");

		// Wait for overlay
		await page.waitForSelector('[data-slot="dialog-content"]');

		// Verify overlay title
		await expect(page.locator("text=/mcp tools/i")).toBeVisible();
	});

	test("filters tools by search", async ({ page }) => {
		// Open overlay
		const input = page.locator('textarea, input[type="text"]').last();
		await input.fill(":mcp");
		await page.keyboard.press("Enter");

		await page.waitForSelector('[data-slot="dialog-content"]');

		// Type in search
		const searchInput = page.locator('input[placeholder*="Search"]');
		await searchInput.fill("file");

		// Wait for debounce
		await page.waitForTimeout(500);

		// Verify filtered results
		const cards = page.locator('[role="checkbox"]');
		const count = await cards.count();
		expect(count).toBeGreaterThan(0);
	});

	test("selects and applies tools", async ({ page }) => {
		// Open overlay
		const input = page.locator('textarea, input[type="text"]').last();
		await input.fill(":mcp");
		await page.keyboard.press("Enter");

		await page.waitForSelector('[data-slot="dialog-content"]');

		// Select first tool
		const firstCard = page.locator('[role="checkbox"]').first();
		await firstCard.click();

		// Verify selected count
		await expect(page.locator("text=/selected: 1 tool/i")).toBeVisible();

		// Click apply
		await page.click('button:has-text("Apply")');

		// Overlay should close
		await expect(
			page.locator('[data-slot="dialog-content"]'),
		).not.toBeVisible();
	});

	test("closes overlay with q key", async ({ page }) => {
		// Open overlay
		const input = page.locator('textarea, input[type="text"]').last();
		await input.fill(":mcp");
		await page.keyboard.press("Enter");

		await page.waitForSelector('[data-slot="dialog-content"]');

		// Press q
		await page.keyboard.press("q");

		// Overlay should close
		await expect(
			page.locator('[data-slot="dialog-content"]'),
		).not.toBeVisible();
	});

	test("only shows one close button", async ({ page }) => {
		// Open overlay
		const input = page.locator('textarea, input[type="text"]').last();
		await input.fill(":mcp");
		await page.keyboard.press("Enter");

		await page.waitForSelector('[data-slot="dialog-content"]');

		// Count close buttons (X icon buttons)
		const closeButtons = page.locator(
			'button:has([data-lucide="x"]), [aria-label*="close" i]',
		);
		const visibleCloseButtons = await closeButtons
			.filter({ hasText: "" })
			.count();

		expect(visibleCloseButtons).toBe(1);
	});
});
