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

  // AC1: the current week get-or-created into DRAFT. Retries within a
  // run see accumulated entries, so self-heal FIRST (anchor on the
  // server-rendered add form per the standing hydration rule), then
  // assert the fresh zero state.
  await expect(page.getByText(/Week of /)).toBeVisible();
  await expect(page.getByText("Draft")).toBeVisible();
  await expect(page.getByText("Add a work day")).toBeVisible({ timeout: 20_000 });
  while (await page.getByRole("button", { name: "Remove" }).count()) {
    await page.getByRole("button", { name: "Remove" }).first().click();
    await page.waitForTimeout(600);
  }
  await expect(page.getByText("0.00")).toBeVisible({ timeout: 20_000 });
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

  // Story 6.2 — work entries with a server-driven running total.
  // Add a full day with a break: 08:00-16:15 minus 30 = 7.75.
  await page.getByLabel("Day").selectOption({ index: 1 });
  await page.getByLabel("Start time").fill("08:00");
  await page.getByLabel("End time").fill("16:15");
  await page.getByLabel("Unpaid break (minutes)").fill("30");
  await page.getByLabel("What you worked on (optional)").fill("Kennel rotation");
  await page.getByRole("button", { name: "Add Entry" }).click();
  await expect(page.getByText("7.75 hours")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("7.75", { exact: true })).toBeVisible();

  // A second, invalid entry is rejected with a specific message.
  await page.getByLabel("Day").selectOption({ index: 2 });
  await page.getByLabel("Start time").fill("14:00");
  await page.getByLabel("End time").fill("09:00");
  await page.getByRole("button", { name: "Add Entry" }).click();
  await expect(
    page.getByText("The shift must end after it starts, on the same day."),
  ).toBeVisible({ timeout: 20_000 });

  // Corrected, it lands and the running total updates server-side.
  // (React re-renders the form after the action round-trip, so refill
  // every field rather than assuming values survived the error.)
  await page.getByLabel("Day").selectOption({ index: 2 });
  await page.getByLabel("Start time").fill("14:00");
  await page.getByLabel("End time").fill("17:00");
  await page.getByRole("button", { name: "Add Entry" }).click();
  await expect(page.getByText("10.75", { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  // Edit the second entry down an hour — total follows.
  await page.getByRole("button", { name: "Edit" }).last().click();
  await page.getByRole("button", { name: "Save Entry" }).waitFor();
  const editForms = page.locator("form", {
    has: page.getByRole("button", { name: "Save Entry" }),
  });
  await editForms.getByLabel("End time").fill("16:00");
  await page.getByRole("button", { name: "Save Entry" }).click();
  await expect(page.getByText("9.75", { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  // Remove it — recalculated from the remaining set.
  await page.getByRole("button", { name: "Remove" }).last().click();
  await expect(page.getByText("7.75", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
});
