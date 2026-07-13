import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  E2E_OPS_USER_EMAIL,
  E2E_OTHER_MANAGER_USER_EMAIL,
  E2E_PARTICIPANT_USER_EMAIL,
  E2E_USER_EMAIL,
} from "./test-user";

/**
 * Placement workspace (Story 5.1): the same fixture placement renders
 * three role-shaped views — full for Operations, no Case Notes for the
 * shelter, plain-language My Placement for the participant — and a
 * cross-organization shelter user is denied.
 */

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await clerk.signIn({ page, signInParams: { strategy: "email_code", identifier: email } });
  await page.waitForFunction(
    () => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user),
    undefined,
    { timeout: 15_000 },
  );
}

test("a coordinator gets the full nine-tab workspace (AC1)", async ({ page }) => {
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/placements");

  await page
    .getByRole("link", { name: "Open placement: Parker Synthetic-Participant" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: /Parker Synthetic-Participant at E2E Test Shelter \(Synthetic\)/,
    }),
  ).toBeVisible({ timeout: 20_000 });

  // Header identity + the lifecycle timeline with the current stage.
  await expect(page.getByText("Placement PLC-E2E-PARKER1")).toBeVisible();
  const timeline = page.getByRole("list", { name: "Placement lifecycle" });
  await expect(timeline.getByText("Onboarding")).toBeVisible();
  await expect(timeline.getByText("(current stage)")).toBeVisible();

  // All nine tabs, Case Notes included for Nova (AC1).
  for (const label of [
    "Overview",
    "Schedule",
    "Hours",
    "Evaluations",
    "Incidents",
    "Case Notes",
    "Documents",
    "Funding",
    "History",
  ]) {
    await expect(page.getByRole("tab", { name: label })).toBeVisible();
  }

  // History shows the lifecycle trail with actors.
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText(/Approved → .*Onboarding/)).toBeVisible({
    timeout: 20_000,
  });
});

test("a shelter user sees the workspace without Case Notes (AC2)", async ({ page }) => {
  await signIn(page, E2E_USER_EMAIL);
  await page.goto("/shelter/placements");

  await page.getByRole("link", { name: /Parker Synthetic-Participant/ }).click();
  await expect(
    page.getByRole("heading", {
      name: /Parker Synthetic-Participant at E2E Test Shelter \(Synthetic\)/,
    }),
  ).toBeVisible({ timeout: 20_000 });

  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Case Notes" })).toHaveCount(0);
  await expect(page.getByText("Case Notes")).toHaveCount(0);
});

test("a cross-organization shelter manager is denied (AC5)", async ({ page }) => {
  await signIn(page, E2E_OTHER_MANAGER_USER_EMAIL);
  await page.goto("/shelter/placements/e2e_placement_participant");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible({ timeout: 20_000 });
});

test("the participant sees My Placement in plain language (AC3)", async ({ page }) => {
  await signIn(page, E2E_PARTICIPANT_USER_EMAIL);
  await page.goto("/participant/placement");

  await expect(
    page.getByRole("heading", { level: 1, name: "My Placement" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Getting ready to start")).toBeVisible();
  await expect(
    page.getByText(/E2E Test Shelter \(Synthetic\) — Main Site \(Synthetic\)/),
  ).toBeVisible();
  await expect(page.getByText("PLC-E2E-PARKER1")).toBeVisible();
  // Plain language only — no internal tab shell, no case notes, no codes.
  await expect(page.getByText(/Case Notes|ONBOARDING|blocker/)).toHaveCount(0);
});

test("the workspace stays usable at 360px with no horizontal page scroll (AC6)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/placements/records/e2e_placement_participant");

  await expect(
    page.getByRole("heading", { name: /Parker Synthetic-Participant/ }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
