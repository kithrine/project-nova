import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

import { E2E_OPS_USER_EMAIL } from "./test-user";

/**
 * Matching readiness (Story 3.6): the coordinator watches the blocker list
 * shrink from three (task, training, expired required certification) to the
 * explicit ready state. One retry-safe journey on a dedicated fixture: each
 * step skips itself if a prior flaky attempt already did it.
 */

async function signInAsCoordinator(page: Page) {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    signInParams: { strategy: "email_code", identifier: E2E_OPS_USER_EMAIL },
  });
  await page.waitForFunction(
    () => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user),
    undefined,
    { timeout: 15_000 },
  );
}

test("the blocker list shrinks to the ready state as requirements complete", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signInAsCoordinator(page);
  await page.goto("/operations/enrollments/e2e_enrollment_readiness");

  await expect(
    page.getByRole("heading", { level: 2, name: "Matching readiness" }),
  ).toBeVisible({ timeout: 20_000 });

  // Three blockers with actionable links (skipped gracefully on retries).
  const taskBlocker = page.getByText("Onboarding task: Confirm readiness paperwork");
  if (await taskBlocker.isVisible().catch(() => false)) {
    await expect(
      page.getByText("Training: Core Readiness Training (Synthetic)"),
    ).toBeVisible();
    await expect(
      page.getByText("Certification: Safety Credential (Synthetic)"),
    ).toBeVisible();
    await expect(page.getByText("Required certification has expired")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to onboarding tasks" })).toHaveAttribute(
      "href",
      "#onboarding-tasks",
    );
  }

  // 1) Complete the required task.
  const completeTask = page.getByRole("button", {
    name: "Complete: Confirm readiness paperwork",
  });
  if (await completeTask.isVisible().catch(() => false)) {
    await completeTask.click();
    await expect(taskBlocker).toBeHidden({ timeout: 20_000 });
  }

  // 2) Enroll, start, and complete the required training.
  const trainingSelect = page.getByLabel("Training program");
  if (await trainingSelect.isVisible().catch(() => false)) {
    await trainingSelect.selectOption({ label: "Core Readiness Training (Synthetic)" });
    await page.getByRole("button", { name: "Enroll participant" }).click();
    await expect(page.getByText("Enrolled", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  }
  const startTraining = page.getByRole("button", { name: "Start training" });
  if (await startTraining.isVisible().catch(() => false)) {
    await startTraining.click();
    await expect(page.getByText("In progress", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  }
  const evidence = page.getByLabel("Completion evidence");
  if (await evidence.isVisible().catch(() => false)) {
    await evidence.selectOption("PROVIDER_VERIFICATION");
    await page.getByRole("button", { name: "Record completion" }).click();
    await expect(
      page.getByText("Training: Core Readiness Training (Synthetic)"),
    ).toBeHidden({ timeout: 20_000 });
  }

  // 3) Renew the expired required certification via an edit (3.5 AC5 flow).
  const editCert = page.getByRole("button", {
    name: "Edit: Safety Credential (Synthetic)",
  });
  if (await editCert.isVisible().catch(() => false)) {
    const certBlocker = page.getByText("Certification: Safety Credential (Synthetic)");
    const stillBlocked = await certBlocker.isVisible().catch(() => false);
    if (stillBlocked) {
      await editCert.click();
      // Scope to the edit form — the record-new form carries the same label.
      const editForm = page
        .locator("form")
        .filter({ hasText: "Save Changes: Safety Credential (Synthetic)" });
      await editForm.getByLabel("Expires on (optional)").fill("2030-01-01");
      await editForm
        .getByRole("button", { name: "Save Changes: Safety Credential (Synthetic)" })
        .click();
      await expect(certBlocker).toBeHidden({ timeout: 20_000 });
    }
  }

  // The explicit ready state — never a blank panel (AC3).
  await expect(
    page.getByText(/No outstanding requirements — this enrollment is ready for matching/),
  ).toBeVisible({ timeout: 20_000 });
});
