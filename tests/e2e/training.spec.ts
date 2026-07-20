import { expect, test } from "@playwright/test";

import { E2E_OPS_USER_EMAIL } from "./test-user";
import { signIn } from "./sign-in";

test("a coordinator enrolls, starts, and completes portable training with evidence", async ({
  page,
}) => {
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/enrollments/e2e_enrollment_training");

  await expect(
    page.getByRole("heading", { level: 1, name: "Taylor Synthetic-Training" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 2, name: "Training" })).toBeVisible();
  await expect(
    page.getByText(/does not replace a shelter's site-specific safety orientation/i),
  ).toBeVisible();

  await page
    .getByLabel("Training program")
    .selectOption({ label: "Workplace Readiness and Communication" });
  await page.getByLabel("Provider (optional)").fill("E2E Learning Partner");
  await page.getByRole("button", { name: "Enroll participant" }).click();
  await expect(page.getByText("Enrolled", { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.getByText("In progress", { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByLabel("Completion evidence").selectOption("PROVIDER_VERIFICATION");
  await page.getByRole("button", { name: "Record completion" }).click();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Provider completion verified/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Record completion" })).toBeHidden();
});
