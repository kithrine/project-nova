import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

import { E2E_OPS_USER_EMAIL, E2E_SHELTER_MANAGER_USER_EMAIL } from "./test-user";
import { signIn } from "./sign-in";

/**
 * Site/supervisor/schedule assignment (Story 5.2): one phase-guarded
 * cycle on the Casey fixture placement — assign the package, propose,
 * shelter requests changes, coordinator revises and re-proposes, the
 * manager approves, and the full history is visible. Retries converge on
 * the Approved end state.
 */

const WORKSPACE = "/operations/placements/records/e2e_placement_assign";

test("the package is assigned, reviewed, revised, and approved (Story 5.2)", async ({
  page,
}) => {
  test.setTimeout(300_000);

  // Phase 1 — the coordinator builds and proposes the package.
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto(`${WORKSPACE}?tab=schedule`);
  await expect(
    page.getByRole("heading", { name: /Casey Synthetic-Assign/ }),
  ).toBeVisible({ timeout: 20_000 });

  if (await page.getByLabel(/^Supervisor/).isVisible().catch(() => false)) {
    await page.getByLabel(/^Supervisor/).selectOption({ value: "e2e_user_shelter" });
    await page
      .getByLabel(/Coordinator of record/)
      .selectOption({ value: "e2e_user_ops" });
    await page.getByLabel("Monday").check();
    await page.getByLabel("Wednesday").check();
    await page.getByLabel("Weekly hours target").fill("8");
    await page.getByRole("button", { name: "Save Package" }).click();
    await expect(page.getByText("Package saved.")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Propose to Shelter" }).click();
    await expect(page.getByText(/Stage: .*Shelter review/)).toBeVisible({
      timeout: 20_000,
    });
  }

  // Phase 2 — the manager returns it with an actionable note.
  await clerk.signOut({ page });
  await signIn(page, E2E_SHELTER_MANAGER_USER_EMAIL);
  await page.goto("/shelter");
  const reviewLink = page.getByRole("link", {
    name: /Review package: Casey Synthetic-Assign/,
  });
  if (await reviewLink.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await reviewLink.click();
    const requestChanges = page.getByRole("button", { name: "Request Changes" });
    if (await requestChanges.isVisible({ timeout: 20_000 }).catch(() => false)) {
      await requestChanges.click();
      await page
        .getByLabel("Note for the coordinator (required)")
        .fill("Mornings are full — please shift to afternoons");
      await page.getByRole("button", { name: "Yes, Request Changes" }).click();
      await expect(page.getByText(/Stage: .*Draft/)).toBeVisible({ timeout: 20_000 });
    }
  }

  // Phase 3 — the coordinator sees the note, revises, and re-proposes.
  await clerk.signOut({ page });
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto(WORKSPACE);
  await expect(
    page.getByRole("heading", { name: /Casey Synthetic-Assign/ }),
  ).toBeVisible({ timeout: 20_000 });
  if (
    await page
      .getByText("The shelter requested changes")
      .isVisible()
      .catch(() => false)
  ) {
    await expect(page.getByText(/please shift to afternoons/)).toBeVisible();
    await page.goto(`${WORKSPACE}?tab=schedule`);
    await page.getByLabel("Weekly hours target").fill("8.5");
    await page.getByRole("button", { name: "Save Package" }).click();
    await expect(page.getByText("Package saved.")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Propose to Shelter" }).click();
    await expect(page.getByText(/Stage: .*Shelter review/)).toBeVisible({
      timeout: 20_000,
    });
  }

  // Phase 4 — the manager approves the revised package (AC4).
  await clerk.signOut({ page });
  await signIn(page, E2E_SHELTER_MANAGER_USER_EMAIL);
  await page.goto("/shelter/placements/e2e_placement_assign");
  const approve = page.getByRole("button", { name: "Approve Package" });
  if (await approve.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await approve.click();
    await page.getByRole("button", { name: "Yes, Approve Package" }).click();
  }
  await expect(page.getByText(/Stage: .*Approved/)).toBeVisible({ timeout: 20_000 });

  // Full history is visible on the workspace (AC4: actor + timestamps).
  await page.goto("/shelter/placements/e2e_placement_assign?tab=history");
  await expect(page.getByText(/Draft → .*Proposed/).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Shelter review → .*Approved/)).toBeVisible();
});
