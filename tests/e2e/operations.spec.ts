import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

import { E2E_OPS_USER_EMAIL, E2E_RRS_USER_EMAIL, E2E_USER_EMAIL } from "./test-user";

/**
 * Operations applications queue + workspace (Story 2.7). Read-only against
 * the deterministic queue fixture (e2e_app_queue, provisioned each run) —
 * safe for parallel workers. The restricted-background AC is exercised from
 * both sides: a coordinator (no restricted permission) and a Restricted
 * Review Specialist.
 */

async function signIn(page: Page, identifier: string) {
  await page.goto("/sign-in");
  await clerk.signIn({ page, signInParams: { strategy: "email_code", identifier } });
  await page.waitForFunction(
    () => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user),
    undefined,
    { timeout: 15_000 },
  );
}

test("a coordinator works the queue; background stays restricted even by direct URL", async ({
  page,
}) => {
  await signIn(page, E2E_OPS_USER_EMAIL);

  // Queue: the fixture application is present with its internal status.
  await page.goto("/operations/applications");
  await expect(page.getByRole("heading", { level: 1, name: "Applications" })).toBeVisible();
  const fixtureLink = page.getByRole("link", { name: "APP-E2E-QUEUE" });
  await expect(fixtureLink).toBeVisible({ timeout: 20_000 });

  // Filtering by status keeps a SUBMITTED application visible.
  await page.getByRole("link", { name: "Submitted", exact: true }).click();
  await expect(page.getByRole("link", { name: "APP-E2E-QUEUE" })).toBeVisible();

  // Workspace: entity header, internal journey, tabs, phase entry point.
  await page.getByRole("link", { name: "APP-E2E-QUEUE" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Quinn Synthetic-Queue" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("tablist", { name: "Application workspace sections" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Begin Eligibility Review" }),
  ).toBeDisabled();

  // Background via the tab control: Restricted state, no restricted content.
  await page.getByRole("tab", { name: "Background" }).click();
  await expect(page.getByText("Background review is restricted")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText(/viewing restricted background review content/i),
  ).toBeHidden();

  // And via direct URL — same Restricted state (AC3).
  await page.goto("/operations/applications/e2e_app_queue?tab=background");
  await expect(page.getByText("Background review is restricted")).toBeVisible();
});

test("a restricted review specialist sees background content (audited server-side)", async ({
  page,
}) => {
  await signIn(page, E2E_RRS_USER_EMAIL);

  await page.goto("/operations/applications/e2e_app_queue?tab=background");
  await expect(
    page.getByText(/viewing restricted background review content/i),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Background review is restricted")).toBeHidden();
});

test("a shelter user is denied the queue by direct URL (AC5)", async ({ page }) => {
  await signIn(page, E2E_USER_EMAIL);

  await page.goto("/operations/applications");
  await expect(page.getByText(/don't have access/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("APP-E2E-QUEUE")).toBeHidden();
});
