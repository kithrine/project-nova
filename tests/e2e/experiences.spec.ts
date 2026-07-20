import { expect, test } from "@playwright/test";

import {
  E2E_OPS_USER_EMAIL,
  E2E_PARTICIPANT_USER_EMAIL,
  E2E_USER_EMAIL,
} from "./test-user";
import { signIn } from "./sign-in";

/**
 * Role-specific protected layouts (Story 1.7): each user lands on their
 * own shell via /dashboard, and cross-experience access renders the
 * Permission denied state.
 */

test("a shelter user lands on the shelter shell and is denied operations", async ({
  page,
}) => {
  await signIn(page, E2E_USER_EMAIL);

  await page.goto("/dashboard");
  await page.waitForURL(/\/shelter/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Shelter workspace" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Shelter navigation" }).last(),
  ).toBeAttached();

  await page.goto("/operations");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();
});

test("an operations user lands on the operations shell and is denied shelter", async ({
  page,
}) => {
  await signIn(page, E2E_OPS_USER_EMAIL);

  await page.goto("/dashboard");
  await page.waitForURL(/\/operations/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "Operations workspace" }),
  ).toBeVisible();

  await page.goto("/shelter");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();
});

test("a participant lands on the participant shell and is denied operations", async ({
  page,
}) => {
  await signIn(page, E2E_PARTICIPANT_USER_EMAIL);

  await page.goto("/dashboard");
  await page.waitForURL(/\/participant/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: /welcome/i }),
  ).toBeVisible();

  await page.goto("/operations");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();
});

test("the mobile shell offers a collapsible menu with the primary action reachable", async ({
  page,
}) => {
  await signIn(page, E2E_USER_EMAIL);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/shelter");

  const menu = page.getByText("Menu", { exact: true });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(
    page
      .getByRole("navigation", { name: "Shelter navigation" })
      .first()
      .getByRole("link", { name: "Dashboard" }),
  ).toBeVisible();

  // No horizontal scroll at 360px (mobile-first baseline).
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(360);
});
