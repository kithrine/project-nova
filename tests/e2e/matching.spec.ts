import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  E2E_OPS_USER_EMAIL,
  E2E_PARTICIPANT_USER_EMAIL,
  E2E_USER_EMAIL,
} from "./test-user";

/**
 * Matching queue (Story 4.1): the coordinator worklist surfaces the ready
 * fixture participant and shelter capacity, and pairing selection opens the
 * review route; shelter and participant identities are denied.
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

test("a coordinator works the queue and opens a candidate pairing", async ({ page }) => {
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/placements");

  await expect(
    page.getByRole("heading", { level: 1, name: "Matching queue" }),
  ).toBeVisible({ timeout: 20_000 });

  // Retry safety: a previous attempt may have left Quinn mid-match. Clear
  // it through the product's own paths — withdraw a Draft, or record an
  // assisted decline on a Proposed match (Story 4.5).
  const leftover = page.getByRole("link", { name: "Open match: Quinn Synthetic-Match" });
  if (await leftover.isVisible().catch(() => false)) {
    await leftover.click();
    const withdrawConfirm = page.getByLabel(/I no longer want to pursue this match/);
    if (await withdrawConfirm.isVisible().catch(() => false)) {
      await withdrawConfirm.check();
      await page.getByRole("button", { name: "Withdraw Draft" }).click();
    } else {
      await page.getByLabel("The participant declines this placement").check();
      await page.getByLabel(/I confirmed this decision with the participant/).check();
      await page.getByRole("button", { name: "Record Participant Decision" }).click();
      await expect(page.getByText(/Status: .*Declined/)).toBeVisible({ timeout: 20_000 });
      await page.goto("/operations/placements");
    }
    await expect(
      page.getByRole("heading", { level: 1, name: "Matching queue" }),
    ).toBeVisible({ timeout: 20_000 });
  }

  // The ready fixture participant appears as awaiting, with readiness
  // context and the blockers carried over from 3.6 (a required training
  // with no attempt on this fixture program).
  await expect(
    page
      .getByLabel("Participants awaiting match")
      .getByText("Quinn Synthetic-Match", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Participants awaiting match").getByText("Awaiting match"),
  ).toBeVisible();
  await expect(page.getByText(/Availability: Weekday mornings/)).toBeVisible();
  await expect(
    page.getByText(/Re-emerged blockers: Core Readiness Training \(Synthetic\)/),
  ).toBeVisible();

  // Shelter capacity is listed alongside.
  await expect(page.getByText("Main Site (Synthetic) — capacity 3")).toBeVisible();

  // Selecting the pair opens the review route for exactly that pairing.
  await page
    .getByLabel("Candidate shelter site")
    .selectOption({ label: "E2E Test Shelter (Synthetic) — Main Site (Synthetic) (capacity 3)" });
  await page.getByRole("button", { name: "Review Pairing: Quinn Synthetic-Match" }).click();

  await expect(
    page.getByRole("heading", {
      name: /Quinn Synthetic-Match × E2E Test Shelter \(Synthetic\) — Main Site \(Synthetic\)/,
    }),
  ).toBeVisible({ timeout: 20_000 });

  // Story 4.2: the categorical, explainable read — Quinn's fixture program
  // requires a training with no attempt, so the pairing blocks and the
  // panel names exactly why. Text + icon, no score anywhere.
  await expect(
    page.getByRole("heading", { name: "Blocking incompatibility" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText("Training incomplete: 0 of 1 required programs complete."),
  ).toBeVisible();
  await expect(page.getByText(/On file: "Weekday mornings"/)).toBeVisible();
  await expect(
    page.getByText(/Not yet proposed — set on the match draft/).first(),
  ).toBeVisible();
  await expect(page.getByText(/the coordinator makes the decision/i)).toBeVisible();

  // Story 4.3: assemble a draft from the reviewed pairing.
  await page.getByRole("button", { name: "Create Match Draft" }).click();
  await expect(
    page.getByText(/Status: .*Draft.*Coordinator-internal/),
  ).toBeVisible({ timeout: 20_000 });

  // Edit the arrangement — the snapshot re-evaluates on save.
  await page.getByLabel("Candidate schedule").fill("Mon/Wed mornings");
  await page.getByLabel("Candidate start date").fill("2026-08-03");
  await page.getByLabel("Candidate end date").fill("2026-12-04");
  await page.getByRole("button", { name: "Save Draft Details" }).click();
  await expect(page.getByText(/Draft saved — the compatibility read/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Proposed: Mon/Wed mornings")).toBeVisible();

  // The queue now shows this participant as in progress, with the match in
  // the worklist — and a repeat pairing review is Blocked with the reason.
  await page.goto("/operations/placements");
  await expect(
    page.getByLabel("Participants awaiting match").getByText("Match in progress"),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("link", { name: "Open match: Quinn Synthetic-Match" }),
  ).toBeVisible();

  // Story 4.4: complete the draft and propose it across the boundary.
  await page.getByRole("link", { name: "Open match: Quinn Synthetic-Match" }).click();
  await expect(page.getByLabel("Candidate supervisor")).toBeVisible({ timeout: 20_000 });
  // The propose control stays disabled until the core fields are complete.
  await expect(page.getByRole("button", { name: "Propose Match" })).toBeDisabled();
  // Clerk provisioning syncs displayName from the Clerk profile on sign-in,
  // so every fixture identity reads "Synthetic E2E" here.
  await page.getByLabel("Candidate supervisor").selectOption({ label: "Synthetic E2E" });
  await page.getByRole("button", { name: "Save Draft Details" }).click();
  await expect(page.getByText(/Draft saved — the compatibility read/)).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "Propose Match" }).click();
  await expect(page.getByText(/Status: .*Proposed/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Participant decision: .*Pending/)).toBeVisible();
  await expect(page.getByText(/Shelter decision: .*Pending/)).toBeVisible();

  // The shelter side sees it under Placement approvals — their org only.
  await clerk.signOut({ page });
  await signIn(page, E2E_USER_EMAIL);
  await page.goto("/shelter");
  await expect(
    page.getByRole("heading", { name: "Placement approvals" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Quinn Synthetic-Match")).toBeVisible();
  await expect(page.getByText("Schedule: Mon/Wed mornings")).toBeVisible();
  await expect(page.getByText(/Supervisor: Synthetic E2E/).first()).toBeVisible();

  // Story 4.5 (AC3): Quinn communicated a decline by phone — the
  // coordinator records it on Quinn's behalf. The decline is a unilateral
  // veto: the match becomes Declined and Quinn returns to the queue.
  await clerk.signOut({ page });
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/placements");
  await page.getByRole("link", { name: "Open match: Quinn Synthetic-Match" }).click();
  await expect(page.getByText(/Participant decision: .*Pending/)).toBeVisible({
    timeout: 20_000,
  });
  await page.getByLabel("The participant declines this placement").check();
  await page
    .getByLabel(/Note \(optional — Operations-only/)
    .fill("Prefers afternoons — told us by phone");
  await page.getByLabel(/I confirmed this decision with the participant/).check();
  await page.getByRole("button", { name: "Record Participant Decision" }).click();
  await expect(page.getByText(/Status: .*Declined/)).toBeVisible({ timeout: 20_000 });
  // The declined workspace keeps the decision trail: who, when, on whose
  // behalf, and the Operations-only note (4.5 AC6).
  await expect(
    page.getByText(/Participant decision: .*Declined.*recorded by staff/),
  ).toBeVisible();
  await expect(
    page.getByText("Participant note: Prefers afternoons — told us by phone"),
  ).toBeVisible();

  // Quinn is awaiting match again — assemble and propose a fresh match,
  // leaving a live pending proposal for the 4.6 shelter-decision journey.
  await page.goto("/operations/placements");
  await expect(
    page
      .getByLabel("Participants awaiting match")
      .getByText("Quinn Synthetic-Match", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await page
    .getByLabel("Candidate shelter site")
    .selectOption({ label: "E2E Test Shelter (Synthetic) — Main Site (Synthetic) (capacity 3)" });
  await page.getByRole("button", { name: "Review Pairing: Quinn Synthetic-Match" }).click();
  await page.getByRole("button", { name: "Create Match Draft" }).click();
  await expect(page.getByText(/Status: .*Draft/)).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Candidate schedule").fill("Mon/Wed mornings");
  await page.getByLabel("Candidate start date").fill("2026-08-03");
  await page.getByLabel("Candidate end date").fill("2026-12-04");
  await page.getByLabel("Candidate supervisor").selectOption({ label: "Synthetic E2E" });
  await page.getByRole("button", { name: "Save Draft Details" }).click();
  await expect(page.getByText(/Draft saved — the compatibility read/)).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Propose Match" }).click();
  await expect(page.getByText(/Status: .*Proposed/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Participant decision: .*Pending/)).toBeVisible();
});

test("a participant accepts their proposed placement on their dashboard (Story 4.5, AC1)", async ({
  page,
}) => {
  await signIn(page, E2E_PARTICIPANT_USER_EMAIL);
  await page.goto("/participant");

  const proposedHeading = page.getByRole("heading", {
    name: "A placement has been proposed for you",
  });
  const acceptedHeading = page.getByRole("heading", {
    name: "You accepted this placement",
  });
  await expect(proposedHeading.or(acceptedHeading)).toBeVisible({ timeout: 20_000 });

  // Retry safety: acceptance is one-way, so a prior attempt may already
  // have recorded it — the accepted state is then the thing to verify.
  if (await proposedHeading.isVisible().catch(() => false)) {
    await expect(
      page.getByText(/E2E Test Shelter \(Synthetic\) — Main Site \(Synthetic\)/),
    ).toBeVisible();
    await expect(page.getByText("Tue/Thu afternoons")).toBeVisible();

    // Both choices are offered; accepting goes through a confirmation.
    await expect(
      page.getByRole("button", { name: "Decline This Placement" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Accept This Placement" }).click();
    await expect(
      page.getByText(/You're accepting this placement at E2E Test Shelter/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Yes, Accept This Placement" }).click();
  }

  await expect(acceptedHeading).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/nothing more is needed from you right now/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept This Placement" }),
  ).not.toBeVisible();
});

test("a shelter manager is denied the queue (AC6)", async ({ page }) => {
  await signIn(page, E2E_USER_EMAIL);
  await page.goto("/operations/placements");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible({ timeout: 20_000 });
});

test("a participant is denied the queue (AC6)", async ({ page }) => {
  await signIn(page, E2E_PARTICIPANT_USER_EMAIL);
  await page.goto("/operations/placements");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible({ timeout: 20_000 });
});
