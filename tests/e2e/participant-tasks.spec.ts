import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

import { E2E_PARTICIPANT_USER_EMAIL } from "./test-user";

/**
 * Participant onboarding tasks (Story 3.3). Uses the persistent participant
 * identity's dedicated enrollment fixture (two tasks, reset to Not Started
 * by provision-fixtures at the start of every RUN). Written as ONE
 * retry-safe journey: a Playwright retry after a mid-test flake finds the
 * task already completed and still converges on the same final state.
 */

async function signInAsParticipant(page: Page) {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    signInParams: { strategy: "email_code", identifier: E2E_PARTICIPANT_USER_EMAIL },
  });
  await page.waitForFunction(
    () => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user),
    undefined,
    { timeout: 15_000 },
  );
}

test("the dashboard shows onboarding progress and completing an own task updates it live", async ({
  page,
}) => {
  await signInAsParticipant(page);
  await page.goto("/participant");

  await expect(
    page.getByRole("heading", { level: 1, name: "Welcome to Project Nova" }),
  ).toBeVisible();

  // The staff-only task reads as pending with respectful copy — and never
  // grows a completion control (AC2).
  await expect(page.getByText(/Nova staff will take care of this one/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("button", { name: "Mark Done: Verify identity documents" }),
  ).toBeHidden();

  // Complete the participant-completable task (idempotent across retries:
  // if a prior attempt already completed it, skip straight to the outcome).
  const markDone = page.getByRole("button", {
    name: "Mark Done: Confirm your contact information",
  });
  if (await markDone.isVisible().catch(() => false)) {
    await expect(
      page.getByText("0 of 2 complete · 2 to go — at your own pace."),
    ).toBeVisible();
    await markDone.click();
  }

  // Live progress reflects the completion (AC1); the control retires.
  await expect(
    page.getByText("1 of 2 complete · 1 to go — at your own pace."),
  ).toBeVisible({ timeout: 20_000 });
  await expect(markDone).toBeHidden();
  await expect(page.getByText(/Complete · /)).toBeVisible();
});
