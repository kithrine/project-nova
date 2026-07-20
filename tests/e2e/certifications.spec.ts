import { expect, test } from "@playwright/test";

import { E2E_OPS_USER_EMAIL, E2E_PARTICIPANT_USER_EMAIL } from "./test-user";
import { signIn } from "./sign-in";

/**
 * Certifications (Story 3.5). The coordinator records a credential with a
 * real attached document through the presigned private-store flow; the
 * participant identity sees their own fixture certification read-only.
 */

test("a coordinator records a certification and attaches its document", async ({
  page,
}) => {
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/enrollments/e2e_enrollment_training");

  await expect(
    page.getByRole("heading", { level: 2, name: "Certifications" }),
  ).toBeVisible({ timeout: 20_000 });

  // Record (idempotent across retries: skip if a prior attempt saved it).
  const name = page.getByLabel("Certification", { exact: true });
  if (await name.isVisible().catch(() => false)) {
    await name.fill("Synthetic Handling Credential");
    await page.getByLabel("Issuer").fill("E2E Issuer");
    await page.getByLabel("Issued on").fill("2026-07-01");
    await page.getByLabel("Expires on (optional)").fill("2028-07-01");
    await page.getByRole("button", { name: "Record Certification" }).click();
  }
  await expect(
    page.getByText("Synthetic Handling Credential", { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Active", { exact: true })).toBeVisible();

  // Attach a real file through the private-store presigned flow.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  await page
    .locator('input[id^="attach-"]')
    .setInputFiles({ name: "credential.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("link", { name: /View document/ })).toBeVisible({
    timeout: 30_000,
  });
});

test("a participant sees their own certifications, read-only (AC4)", async ({ page }) => {
  await signIn(page, E2E_PARTICIPANT_USER_EMAIL);
  await page.goto("/participant/certifications");

  await expect(
    page.getByRole("heading", { level: 1, name: "Certifications" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Pet First Aid & CPR (Synthetic)")).toBeVisible();
  await expect(page.getByText("Synthetic Animal Care Academy")).toBeVisible();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();

  // Read-only and participant-safe: no record controls, no required flag.
  await expect(page.getByRole("button", { name: /Record/ })).toBeHidden();
  await expect(page.getByText(/Required for matching/)).toBeHidden();
});
