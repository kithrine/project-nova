import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./sign-in";
import {
  E2E_GRANT_ADMIN_USER_EMAIL,
  E2E_HOURS_USER_EMAIL,
  E2E_OPS_USER_EMAIL,
  E2E_SHELTER_MANAGER_USER_EMAIL,
  E2E_USER_EMAIL,
} from "./test-user";

/**
 * Story 7.7 — the systematic WCAG 2.2 AA pass across all four signed-in
 * experiences (docs/ux/accessibility.md). Each role signs in once and
 * axe-scans its critical screens; failures list every violation with the
 * offending page. These need fixtures and Clerk sessions, so they run in
 * the full local suite (every story ships behind it); the CI merge gate
 * scans the public surface in tests/e2e/a11y.spec.ts (smoke-only mode —
 * concurrent CI runs must not fight over fixed-id fixtures).
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scanPages(
  page: Page,
  paths: readonly string[],
): Promise<string[]> {
  const failures: string[] = [];
  for (const path of paths) {
    await page.goto(path);
    // Anchor on the page's h1 so axe scans settled content, not a
    // loading state.
    await expect(
      page.getByRole("heading", { level: 1 }).first(),
      `h1 on ${path}`,
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    for (const violation of results.violations) {
      failures.push(
        `${path}: ${violation.id} (${violation.impact}) — ${violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(" "))
          .join(" | ")}`,
      );
    }
  }
  return failures;
}

test("participant screens pass WCAG A/AA (7.7)", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_HOURS_USER_EMAIL);
  const failures = await scanPages(page, [
    "/participant",
    "/participant/application",
    "/participant/placement",
    "/participant/hours",
    "/participant/certifications",
  ]);
  expect(failures).toEqual([]);
});

test("shelter supervisor screens pass WCAG A/AA (7.7)", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_USER_EMAIL);
  const failures = await scanPages(page, [
    "/shelter",
    "/shelter/placements",
    "/shelter/timesheets",
  ]);
  expect(failures).toEqual([]);
});

test("shelter manager screens pass WCAG A/AA (7.7)", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_SHELTER_MANAGER_USER_EMAIL);
  const failures = await scanPages(page, ["/shelter", "/shelter/organization"]);
  expect(failures).toEqual([]);
});

test("operations coordinator screens pass WCAG A/AA (7.7)", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_OPS_USER_EMAIL);
  const failures = await scanPages(page, [
    "/operations",
    "/operations/applications",
    "/operations/placements",
    "/operations/reports",
    "/operations/reports/active-placements",
    "/operations/administration",
  ]);

  // The placement workspace — the app's densest screen — reached by
  // clicking through, since its URL carries a fixture-dependent id.
  await page.goto("/operations/placements");
  await page
    .getByRole("link", { name: /^Open placement:/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const workspace = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  for (const violation of workspace.violations) {
    failures.push(`placement workspace: ${violation.id} (${violation.impact})`);
  }

  expect(failures).toEqual([]);
});

test("grant administrator screens pass WCAG A/AA (7.7)", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_GRANT_ADMIN_USER_EMAIL);
  const failures = await scanPages(page, [
    "/operations/reports/hours-by-funding",
    "/operations/reports/shelter-roster",
    "/operations/reports/outcome-summary",
    "/operations/reports/exports",
    "/operations/administration/audit",
  ]);
  expect(failures).toEqual([]);
});

test("keyboard: skip link is first, lands on main content, and focus stays visible (7.7)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/reports");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content/);

  // Focus indicators are real: the next focusable shows the outline ring.
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement;
    return getComputedStyle(active).outlineStyle;
  });
  expect(outline).not.toBe("none");
});

test("reduced motion suppresses transitions app-wide (7.7)", async ({ page }) => {
  test.setTimeout(300_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const durations = await page.evaluate(() => {
    const skip = document.querySelector(".skip-link");
    const anyLink = document.querySelector("a");
    return [
      skip ? getComputedStyle(skip).transitionDuration : "",
      anyLink ? getComputedStyle(anyLink).transitionDuration : "",
    ];
  });
  for (const duration of durations.filter(Boolean)) {
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.01);
  }
});
