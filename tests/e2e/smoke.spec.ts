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
 * Mobile nav pass (2026-07-20) — below md the header links collapse
 * behind a hamburger disclosure; opening it reveals the links, and a
 * client-side navigation closes it again (the public layout — and the
 * menu's state — survives route changes).
 */
test("mobile nav collapses to a hamburger that reveals the links at 360px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Public" });
  const menuButton = nav.getByRole("button", { name: "Menu" });
  await expect(menuButton).toBeVisible();
  await expect(nav.getByRole("link", { name: "How It Works" })).toBeHidden();

  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("link", { name: "How It Works" })).toBeVisible();

  await nav.getByRole("link", { name: "How It Works" }).click();
  await page.waitForURL(/\/how-it-works/, { timeout: 15_000 });
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
});

test("desktop keeps the inline nav with no hamburger", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Public" });
  await expect(nav.getByRole("button", { name: "Menu" })).toBeHidden();
  await expect(nav.getByRole("link", { name: "How It Works" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Apply Now" })).toBeVisible();
});

/**
 * Sticky header (2026-07-20) — the public header pins to the viewport
 * top while scrolling, stays usable there (hamburger opens mid-page),
 * and in-page anchor jumps land BELOW the bar (scroll-mt compensation
 * on #journey and main#main-content).
 */
test("public header stays pinned and usable while scrolled at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, 600));
  const header = page.locator("header").first();
  await expect
    .poll(async () => header.evaluate((el) => Math.round(el.getBoundingClientRect().top)))
    .toBe(0);

  const nav = page.getByRole("navigation", { name: "Public" });
  const menuButton = nav.getByRole("button", { name: "Menu" });
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("link", { name: "How It Works" })).toBeVisible();
});

test("focus-driven scrolling keeps the focused element clear of the sticky bar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const cta = page.getByRole("link", { name: "Start Your Application" });
  // Park the CTA just above the viewport — the minimal-scroll case that
  // would land it flush under the pinned bar without scroll-padding-top
  // (WCAG 2.4.11), then let native focus() trigger the scroll-into-view.
  await cta.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + rect.bottom + 40);
  });
  await cta.focus();
  const headerBottom = await page
    .locator("header")
    .first()
    .evaluate((el) => el.getBoundingClientRect().bottom);
  const ctaTop = await cta.evaluate((el) => el.getBoundingClientRect().top);
  expect(ctaTop).toBeGreaterThanOrEqual(headerBottom);
});

test("see-the-journey anchor jump lands below the sticky header", async ({ page }) => {
  await page.goto("/how-it-works");
  await page.getByRole("link", { name: "See the journey" }).click();
  const headerBottom = await page
    .locator("header")
    .first()
    .evaluate((el) => el.getBoundingClientRect().bottom);
  const journeyTop = await page
    .locator("#journey")
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(journeyTop).toBeGreaterThanOrEqual(headerBottom);
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
