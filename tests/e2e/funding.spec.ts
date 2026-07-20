import { expect, test } from "@playwright/test";

import { E2E_GRANT_ADMIN_USER_EMAIL, E2E_OPS_USER_EMAIL } from "./test-user";
import { signIn } from "./sign-in";

/**
 * Funding-source administration (Story 1.8). Rows created here carry the
 * "E2E Synthetic" prefix and are cleaned by the next run's global setup.
 */

test("a Grant Administrator can create, see, and deactivate a funding source", async ({
  page,
}) => {
  await signIn(page, E2E_GRANT_ADMIN_USER_EMAIL);

  await page.goto("/operations/administration/funding-sources");
  await expect(page.getByRole("heading", { level: 1, name: "Funding sources" })).toBeVisible();

  // Create
  const name = "E2E Synthetic Grant";
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Kind").selectOption("GRANT");
  await page.getByLabel(/code/i).fill("E2E-42");
  await page.getByRole("button", { name: "Create Funding Source" }).click();

  // Back on the list, the new source appears
  await page.waitForURL(/funding-sources$/, { timeout: 15_000 });
  const row = page.getByRole("link", { name });
  await expect(row).toBeVisible();

  // Detail: deactivate (explicit status transition, archive-not-delete)
  await row.click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.getByRole("button", { name: "Deactivate Funding Source" }).click();
  await expect(page.getByText("Status: Inactive")).toBeVisible({ timeout: 15_000 });
  // Still present (preserved), now offering reactivation
  await expect(
    page.getByRole("button", { name: "Reactivate Funding Source" }),
  ).toBeVisible();
});

test("a Program Coordinator is denied funding administration server-side", async ({
  page,
}) => {
  await signIn(page, E2E_OPS_USER_EMAIL);

  await page.goto("/operations/administration/funding-sources");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();
});
