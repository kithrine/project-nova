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

  // The ready fixture participant appears as awaiting, with readiness
  // context and the blockers carried over from 3.6 (a required training
  // with no attempt on this fixture program).
  await expect(page.getByText("Quinn Synthetic-Match", { exact: true })).toBeVisible();
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

  // Withdraw to finish the journey (leaves the fixture clean for reruns).
  await page.getByRole("link", { name: "Open match: Quinn Synthetic-Match" }).click();
  await page.getByRole("checkbox", { name: /withdrawing is final/i }).check();
  await page.getByRole("button", { name: "Withdraw Draft" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Matching queue" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByLabel("Participants awaiting match").getByText("Awaiting match"),
  ).toBeVisible();
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
