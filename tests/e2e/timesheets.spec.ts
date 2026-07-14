import { expect, test } from "@playwright/test";

import { E2E_HOURS_USER_EMAIL } from "./test-user";
import { signIn } from "./sign-in";

/**
 * Weekly timesheets (Story 6.1): Harper — the participant with an ACTIVE
 * placement — opens My Hours for the first time and lands on a ready,
 * empty DRAFT week; navigation reaches a prior week and creates it on
 * demand; a future week is blocked with a stated reason. Fixtures reset
 * Harper's timesheets each run, so first-open really creates.
 */

test("a participant opens My Hours and the week is ready (Story 6.1)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signIn(page, E2E_HOURS_USER_EMAIL);
  await page.goto("/participant/hours");

  await expect(
    page.getByRole("heading", { level: 1, name: "My Hours" }),
  ).toBeVisible({ timeout: 20_000 });

  // AC1: the current week get-or-created into DRAFT with zero hours.
  await expect(page.getByText(/Week of /)).toBeVisible();
  await expect(page.getByText("Draft")).toBeVisible();
  await expect(page.getByText("0.00")).toBeVisible();
  await expect(page.getByText(/No hours recorded yet/)).toBeVisible();
  await expect(page.getByText("Hours at Main Site (Synthetic)")).toBeVisible();
  // The current week has no forward navigation (AC4).
  await expect(page.getByText("This is the current week")).toBeVisible();

  // AC3: a prior week within the placement's active period creates on
  // demand and navigates back.
  await page.getByRole("link", { name: "← Previous week" }).click();
  await expect(page.getByText("Draft")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Next week →" })).toBeVisible();

  // AC4: a hand-typed future week is blocked with a stated reason.
  const future = new Date();
  future.setUTCDate(future.getUTCDate() + 14);
  const day = future.getUTCDay();
  future.setUTCDate(future.getUTCDate() - ((day + 6) % 7));
  const futureIso = future.toISOString().slice(0, 10);
  await page.goto(`/participant/hours?week=${futureIso}`);
  await expect(
    page.getByText("Hours can't be recorded for a future week."),
  ).toBeVisible({ timeout: 20_000 });

  // AC2: reopening the current week reuses the same timesheet (still one
  // Draft card, no error, no duplicate-week artifacts).
  await page.goto("/participant/hours");
  await expect(page.getByText("Draft")).toBeVisible({ timeout: 20_000 });
});
