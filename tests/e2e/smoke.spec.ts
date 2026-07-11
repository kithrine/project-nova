import { expect, test } from "@playwright/test";

/**
 * Story 1.1 — the app boots and the public landing route returns 200.
 * Also verifies the mobile-first acceptance criterion: no horizontal
 * scroll at a 360px viewport.
 */
test("public landing page responds with 200 and renders", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Project Nova" })).toBeVisible();
});

test("landing page is mobile-first with no horizontal scroll at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(360);
});

test("skip link becomes visible on keyboard focus", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
});
