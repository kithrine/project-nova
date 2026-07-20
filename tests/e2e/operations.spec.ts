import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

import { E2E_OPS_USER_EMAIL, E2E_RRS_USER_EMAIL, E2E_USER_EMAIL } from "./test-user";
import { signIn } from "./sign-in";

/**
 * Operations applications queue + workspace (Story 2.7). Read-only against
 * the deterministic queue fixture (e2e_app_queue, provisioned each run) —
 * safe for parallel workers. The restricted-background AC is exercised from
 * both sides: a coordinator (no restricted permission) and a Restricted
 * Review Specialist.
 */

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

test("a coordinator records an ordinary rejection through the confirmation panel (Story 2.11)", async ({
  page,
}) => {
  await signIn(page, E2E_OPS_USER_EMAIL);

  await page.goto("/operations/applications/e2e_app_decision");
  await expect(
    page.getByRole("heading", { level: 1, name: "Devon Synthetic-Decision" }),
  ).toBeVisible({ timeout: 20_000 });

  // Two-step confirmation: category AND explicit acknowledgment required.
  await page.getByRole("button", { name: "Reject Application…" }).click();
  const record = page.getByRole("button", { name: "Record Decision" });
  await expect(record).toBeDisabled();
  await page.getByRole("radio", { name: "Other program reason" }).check();
  await expect(record).toBeDisabled();
  await page.getByRole("checkbox", { name: /this decision is final/i }).check();
  await expect(record).toBeEnabled();
  await record.click();

  // The revalidated workspace reflects the terminal state directly (the
  // panel's transient confirmation is covered by its component test).
  await expect(page.getByText(/· Rejected/)).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText("This application is decided — no review actions remain."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText("Submitted → Rejected")).toBeVisible({ timeout: 20_000 });
});

test("a coordinator runs eligibility review: begin, record Eligible, reach Interview (Story 2.8)", async ({
  page,
}) => {
  await signIn(page, E2E_OPS_USER_EMAIL);

  await page.goto("/operations/applications/e2e_app_eligibility?tab=eligibility");
  await expect(page.getByText("Eligibility rubric (ADR-015)")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Begin Eligibility Review" }).click();

  // The review is now in progress; the outcome form appears with its gates.
  const record = page.getByRole("button", { name: "Record Eligibility Outcome" });
  await expect(record).toBeVisible({ timeout: 20_000 });
  await expect(record).toBeDisabled();
  await page.getByRole("radio", { name: /Eligible — advances/ }).check();
  await page.getByLabel(/Rationale \(internal\)/).fill("Synthetic: meets every rubric item.");
  await page.getByRole("checkbox", { name: /ADR-015 rubric only/i }).check();
  await record.click();

  // Eligible advances the application to the Interview phase.
  await expect(page.getByText(/· Interview/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Outcome: Eligible")).toBeVisible();
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText("Submitted → Eligibility review")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Eligibility review → Interview")).toBeVisible();
});

test("a coordinator schedules an interview, reschedules with history, and advances (Story 2.9)", async ({
  page,
}) => {
  await signIn(page, E2E_OPS_USER_EMAIL);

  await page.goto("/operations/applications/e2e_app_interview?tab=interview");
  await expect(page.getByLabel("Date and time")).toBeVisible({ timeout: 20_000 });

  // Schedule.
  await page.getByLabel("Date and time").fill("2026-08-01T10:30");
  await page.getByLabel("Format").selectOption("IN_PERSON");
  await page.getByRole("button", { name: "Schedule Interview" }).click();
  await expect(page.getByText("August 1, 2026 at 10:30 AM · In person")).toBeVisible({
    timeout: 20_000,
  });

  // Reschedule — the prior time is preserved as history.
  await page.getByRole("button", { name: "Reschedule…" }).click();
  await page.getByLabel("Date and time").fill("2026-08-03T15:00");
  await page.getByLabel("Format").selectOption("VIRTUAL");
  await page.getByRole("button", { name: "Reschedule Interview" }).click();
  await expect(page.getByText("August 3, 2026 at 3:00 PM · Virtual")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/August 1, 2026 at 10:30 AM.*rescheduled/)).toBeVisible();

  // Record Advance: outcome + notes + confirmation, then Background review.
  const record = page.getByRole("button", { name: "Record Interview Outcome" });
  await expect(record).toBeDisabled();
  await page.getByRole("radio", { name: /Advance — moves/ }).check();
  await page.getByLabel("Internal notes").fill("Synthetic: advance to background.");
  await page.getByRole("checkbox", { name: /ready to record/i }).check();
  await record.click();

  await expect(page.getByText(/· Background review/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText("Interview → Background review")).toBeVisible({
    timeout: 20_000,
  });
});

test("the specialist clears the background check and the coordinator accepts (Stories 2.10 + 2.11)", async ({
  page,
}) => {
  // The Restricted Review Specialist records the Clear outcome.
  await signIn(page, E2E_RRS_USER_EMAIL);
  await page.goto("/operations/applications/e2e_app_background?tab=background");
  await expect(
    page.getByText(/viewing restricted background review content/i),
  ).toBeVisible({ timeout: 20_000 });

  const record = page.getByRole("button", { name: "Record Background Decision" });
  await expect(record).toBeDisabled();
  await page.getByRole("radio", { name: /Clear — the application/ }).check();
  await page
    .getByLabel("Restricted rationale")
    .fill("Synthetic: external check complete, no concerns.");
  await page.getByRole("checkbox", { name: /final and audited/i }).check();
  await record.click();
  await expect(page.getByText("Outcome: Clear")).toBeVisible({ timeout: 20_000 });

  // Still BACKGROUND_REVIEW — never auto-accepted.
  await expect(page.getByText(/· Background review/)).toBeVisible();
  await clerk.signOut({ page });

  // The coordinator's Accept is now live — the full pipeline completes.
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/applications/e2e_app_background");
  const accept = page.getByRole("button", { name: "Accept Application" });
  await expect(accept).toBeEnabled({ timeout: 20_000 });
  await accept.click();

  await expect(page.getByText(/· Accepted/)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText("Background review → Accepted")).toBeVisible({
    timeout: 20_000,
  });

  // Story 3.1: the same transaction created the enrollment — the participant
  // appears in the enrollment view with no manual follow-up.
  await page.getByRole("tab", { name: "Overview" }).click();
  await expect(page.getByText("Accepted — enrollment created")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("link", { name: "View Enrollment" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Blair Synthetic-Background" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/Transitional Employment Program · Onboarding/),
  ).toBeVisible();

  // Story 3.2: the onboarding checklist generated with the enrollment —
  // populated with no manual setup, every task Not started.
  await expect(
    page.getByText("Attend orientation session", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Review the program handbook", { exact: true }),
  ).toBeVisible();

  // Retry-safety: if a prior flaky attempt completed the orientation task,
  // restore it before asserting the clean-slate counts.
  const leftoverReopen = page.getByRole("button", {
    name: "Reopen: Attend orientation session",
  });
  if (await leftoverReopen.isVisible().catch(() => false)) {
    await leftoverReopen.click();
    await expect(
      page.getByRole("button", { name: "Complete: Attend orientation session" }),
    ).toBeVisible({ timeout: 20_000 });
  }
  expect(await page.getByText("Not started", { exact: true }).count()).toBe(5);
  await expect(page.getByText("0 of 5 complete · 5 remaining")).toBeVisible();

  // Story 3.3: the coordinator completes a staff task, then reopens it —
  // the corrective loop, each control named after its task.
  await page
    .getByRole("button", { name: "Complete: Attend orientation session" })
    .click();
  const reopen = page.getByRole("button", {
    name: "Reopen: Attend orientation session",
  });
  await expect(reopen).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Completed .* by Synthetic E2E Coordinator/)).toBeVisible();

  await reopen.click();
  await expect(
    page.getByRole("button", { name: "Complete: Attend orientation session" }),
  ).toBeVisible({ timeout: 20_000 });
  expect(await page.getByText("Not started", { exact: true }).count()).toBe(5);
});

test("a shelter user is denied the queue by direct URL (AC5)", async ({ page }) => {
  await signIn(page, E2E_USER_EMAIL);

  await page.goto("/operations/applications");
  await expect(page.getByText(/don't have access/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("APP-E2E-QUEUE")).toBeHidden();
});
