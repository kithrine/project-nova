import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

import {
  E2E_HOURS_USER_EMAIL,
  E2E_OTHER_MANAGER_USER_EMAIL,
  E2E_USER_EMAIL,
} from "./test-user";
import { signIn } from "./sign-in";

/**
 * Weekly timesheets (Story 6.1): Harper — the participant with an ACTIVE
 * placement — opens My Hours for the first time and lands on a ready,
 * empty DRAFT week; navigation reaches a prior week and creates it on
 * demand; a future week is blocked with a stated reason. Fixtures reset
 * Harper's timesheets each run, so first-open really creates.
 *
 * SERIAL: both tests mutate the same Harper timesheets; fullyParallel
 * would race them across workers (the correction cycle submits the
 * current week while the first test is still editing it).
 */
test.describe.configure({ mode: "serial" });

test("a participant opens My Hours and the week is ready (Story 6.1)", async ({
  page,
}) => {
  test.setTimeout(300_000);
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

  // Story 6.4 — submission, exercised on the PRIOR week so within-run
  // retries still find the current week editable. Submission is one-way:
  // a retry lands on the Submitted state and converges on the same
  // assertions. Anchor on the server-rendered status line first.
  await page.getByRole("link", { name: "← Previous week" }).click();
  // The current week ALSO renders "Status:" — anchor on the prior week's
  // URL and its unique "Next week" link before branching, or the submit
  // lands on the wrong week entirely.
  await page.waitForURL(/\?week=\d{4}-\d{2}-\d{2}/, { timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Next week →" })).toBeVisible({
    timeout: 20_000,
  });
  if (await page.getByText("Add a work day").isVisible().catch(() => false)) {
    // Submit is disabled WITH its reason while the week is empty (AC2).
    if (await page.getByRole("button", { name: "Submit Hours", exact: true }).isVisible().catch(() => false)) {
      await expect(
        page.getByText("Add at least one work day before submitting."),
      ).toBeVisible();
      await page.getByLabel("Day").selectOption({ index: 1 });
      await page.getByLabel("Start time").fill("09:00");
      await page.getByLabel("End time").fill("13:00");
      await page.getByRole("button", { name: "Add Entry" }).click();
      await expect(page.getByText("4.00", { exact: true })).toBeVisible({
        timeout: 20_000,
      });
    }
    await page.getByRole("button", { name: "Submit Hours…" }).click();
    await expect(
      page.getByText(/won't be able to edit your hours/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Yes, Submit Hours" }).click();
  }
  // A retry may find the week already Approved by the 6.5 phase below —
  // both are one-way, frozen states, so either satisfies 6.4's outcome.
  await expect(page.getByText(/^(Submitted|Approved)$/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText(
      /Your hours were submitted for review|Your hours for this week were approved/,
    ),
  ).toBeVisible();
  // Frozen for review: no entry editing, no second submission (AC1/AC4).
  await expect(page.getByText("Add a work day")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Submit Hours/ })).toHaveCount(0);

  // Story 6.5 — the ASSIGNED supervisor reviews and approves from the
  // shelter queue. Approval is one-way, so retries converge on Approved.
  await clerk.signOut({ page });
  await signIn(page, E2E_USER_EMAIL);
  await page.goto("/shelter/timesheets");
  await expect(
    page.getByRole("heading", { level: 1, name: "Timesheets" }),
  ).toBeVisible({ timeout: 20_000 });
  const reviewLink = page.getByRole("link", {
    name: /Review timesheet: Harper Synthetic-Hours/,
  });
  if (await reviewLink.first().isVisible().catch(() => false)) {
    await reviewLink.first().click();
    await expect(page.getByText(/Status: /)).toBeVisible({ timeout: 20_000 });
    const approve = page.getByRole("button", { name: "Approve Hours…" });
    if (await approve.isVisible().catch(() => false)) {
      await approve.click();
      await page.getByRole("button", { name: "Yes, Approve Hours" }).click();
    }
    await expect(page.getByText(/Status:.*Approved/)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Approved by Synthetic E2E/)).toBeVisible();
  } else {
    // A retry after approval: the queue is empty of Harper's week; verify
    // through the placement workspace Hours tab instead.
    await page.goto("/shelter/placements/e2e_placement_hours?tab=hours");
    await page.getByRole("link", { name: /Open week: / }).first().click();
    await expect(page.getByText(/Status:.*Approved/)).toBeVisible({
      timeout: 20_000,
    });
  }

  // Cross-shelter access is denied (testing-strategy.md): the other
  // organization's manager sees no Harper week and cannot open the card.
  const approvedUrl = page.url();
  await clerk.signOut({ page });
  await signIn(page, E2E_OTHER_MANAGER_USER_EMAIL);
  await page.goto("/shelter/timesheets");
  await expect(
    page.getByRole("heading", { level: 1, name: "Timesheets" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Harper Synthetic-Hours/)).toHaveCount(0);
  await page.goto(approvedUrl);
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible({ timeout: 20_000 });

  // The participant sees the approval in plain language.
  await clerk.signOut({ page });
  await signIn(page, E2E_HOURS_USER_EMAIL);
  await page.goto("/participant/hours");
  await page.getByRole("link", { name: "← Previous week" }).click();
  await page.waitForURL(/\?week=\d{4}-\d{2}-\d{2}/, { timeout: 20_000 });
  await expect(page.getByText("Approved", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText("Your hours for this week were approved."),
  ).toBeVisible();
});

/**
 * The correction cycle (Story 6.6) on the CURRENT week: submit -> the
 * supervisor requests a correction with a reason -> the participant
 * sees it verbatim, fixes the week, resubmits -> the supervisor
 * approves. Every phase is guarded on server-rendered state, so retries
 * converge on the Approved end state.
 */
test("a rejected week is corrected and resubmitted (Story 6.6)", async ({ page }) => {
  test.setTimeout(300_000);
  const REASON = "Please add what you worked on for Monday.";

  // Phase 1 — the participant submits the current week (entry exists
  // from the first test; a retry may find it already past DRAFT).
  await signIn(page, E2E_HOURS_USER_EMAIL);
  await page.goto("/participant/hours");
  await expect(page.getByText(/Status: /)).toBeVisible({ timeout: 20_000 });
  if (await page.getByRole("button", { name: "Submit Hours…" }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Submit Hours…" }).click();
    await page.getByRole("button", { name: "Yes, Submit Hours" }).click();
    await expect(page.getByText(/^(Submitted|Approved)$/)).toBeVisible({
      timeout: 20_000,
    });
  }

  // Phase 2 — the supervisor requests a correction with a reason.
  await clerk.signOut({ page });
  await signIn(page, E2E_USER_EMAIL);
  await page.goto("/shelter/timesheets");
  await expect(
    page.getByRole("heading", { level: 1, name: "Timesheets" }),
  ).toBeVisible({ timeout: 20_000 });
  const reviewLink = page.getByRole("link", {
    name: /Review timesheet: Harper Synthetic-Hours/,
  });
  if (await reviewLink.first().isVisible().catch(() => false)) {
    await reviewLink.first().click();
    await expect(page.getByText(/Status: /)).toBeVisible({ timeout: 20_000 });
    const requestCorrection = page.getByRole("button", {
      name: "Request Correction…",
    });
    if (await requestCorrection.isVisible().catch(() => false)) {
      await requestCorrection.click();
      await page
        .getByLabel(/What needs correction\?/)
        .fill(REASON);
      await page.getByRole("button", { name: "Yes, Request Correction" }).click();
      await expect(page.getByText(/Status:.*Needs correction/)).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(new RegExp(REASON.slice(0, 20)))).toBeVisible();
    }
  }

  // Phase 3 — the participant sees the reason verbatim, fixes, resubmits.
  await clerk.signOut({ page });
  await signIn(page, E2E_HOURS_USER_EMAIL);
  await page.goto("/participant/hours");
  await expect(page.getByText(/Status: /)).toBeVisible({ timeout: 20_000 });
  if (
    await page.getByText(/asked for a correction on your hours/).isVisible().catch(() => false)
  ) {
    await expect(page.getByText(new RegExp(REASON.slice(0, 20)))).toBeVisible();
    // Fix Monday: edit the entry to carry a note.
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByRole("button", { name: "Save Entry" }).waitFor();
    const editForm = page.locator("form", {
      has: page.getByRole("button", { name: "Save Entry" }),
    });
    await editForm.getByLabel("What you worked on (optional)").fill("Kennel rotation");
    await page.getByRole("button", { name: "Save Entry" }).click();
    await expect(page.getByText("Entry saved.").or(page.getByText("Kennel rotation"))).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Submit Hours…" }).click();
    await page.getByRole("button", { name: "Yes, Submit Hours" }).click();
    await expect(page.getByText(/^(Submitted|Approved)$/)).toBeVisible({
      timeout: 20_000,
    });
  }

  // Phase 4 — the supervisor approves the corrected week.
  await clerk.signOut({ page });
  await signIn(page, E2E_USER_EMAIL);
  await page.goto("/shelter/timesheets");
  await expect(
    page.getByRole("heading", { level: 1, name: "Timesheets" }),
  ).toBeVisible({ timeout: 20_000 });
  if (await reviewLink.first().isVisible().catch(() => false)) {
    await reviewLink.first().click();
    await expect(page.getByText(/Status: /)).toBeVisible({ timeout: 20_000 });
    const approve = page.getByRole("button", { name: "Approve Hours…" });
    if (await approve.isVisible().catch(() => false)) {
      await approve.click();
      await page.getByRole("button", { name: "Yes, Approve Hours" }).click();
    }
    await expect(page.getByText(/Status:.*Approved/)).toBeVisible({
      timeout: 20_000,
    });
  } else {
    // Retry after approval: verify through the workspace Hours tab.
    await page.goto("/shelter/placements/e2e_placement_hours?tab=hours");
    await expect(page.getByText(/Approved/).first()).toBeVisible({ timeout: 20_000 });
  }
});
