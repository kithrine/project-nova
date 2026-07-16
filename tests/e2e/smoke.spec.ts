import { expect, test } from "@playwright/test";

/**
 * Story 1.1 — the app boots and the public landing route returns 200.
 * Also verifies the mobile-first acceptance criterion: no horizontal
 * scroll at a 360px viewport.
 */
test("public landing page responds with 200 and renders", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Stronger futures start with opportunity." }),
  ).toBeVisible();
});

test("landing page is mobile-first with no horizontal scroll at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(360);
});

/**
 * Story 2.1 — an anonymous visitor can read How It Works and the single
 * primary call to action leads into applicant account onboarding.
 */
test("how it works page renders publicly and its CTA leads to account creation", async ({
  page,
}) => {
  const response = await page.goto("/how-it-works");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const cta = page.getByRole("link", { name: /start your application/i });
  await expect(cta).toHaveCount(1);
  await cta.click();
  await page.waitForURL(/\/sign-up/, { timeout: 15_000 });
});

test("how it works stays single-column with no horizontal scroll at 360px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/how-it-works");
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(360);
});

/**
 * Story 1.3 — the health check reports database connectivity without
 * exposing secrets.
 */
test("health check reports database connectivity", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toEqual({ status: "ok", database: "connected" });
});

test("skip link becomes visible on keyboard focus", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
});
