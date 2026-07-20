import { expect, test } from "@playwright/test";

import { E2E_APPLICANT_USER_EMAIL } from "./test-user";
import { signIn } from "./sign-in";

/**
 * Applicant account onboarding (Story 2.2). This user exists only in Clerk
 * at the start of every run (fixtures reset the internal rows), so this
 * spec proves the whole first-entry path: provision-on-first-sign-in ->
 * onboarding redirect -> validation -> completion -> applicant dashboard.
 * Tests run serially: they are one continuous journey for one identity.
 */
test.describe.configure({ mode: "serial" });

test("a brand-new sign-in is provisioned and routed to account onboarding", async ({
  page,
}) => {
  await signIn(page, E2E_APPLICANT_USER_EMAIL);

  await page.goto("/dashboard");
  await page.waitForURL(/\/participant\/onboarding/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "Set up your account" }),
  ).toBeVisible();
});

test("invalid submissions show accessible field errors and allow retry", async ({ page }) => {
  await signIn(page, E2E_APPLICANT_USER_EMAIL);
  await page.goto("/participant/onboarding");

  // Submit with everything empty (the form disables native validation).
  await page.getByRole("button", { name: "Save and Continue" }).click();
  await expect(page.getByText("Enter your legal first name.")).toBeVisible({
    timeout: 15_000,
  });

  const firstName = page.getByLabel("Legal first name");
  await expect(firstName).toHaveAttribute("aria-invalid", "true");
  await expect(firstName).toHaveAttribute("aria-describedby", "legalFirstName-error");
});

test("completing onboarding lands the applicant on their dashboard", async ({ page }) => {
  await signIn(page, E2E_APPLICANT_USER_EMAIL);
  await page.goto("/participant/onboarding");

  await page.getByLabel("Legal first name").fill("Synthetic");
  await page.getByLabel("Legal last name").fill("Applicant");
  await page.getByLabel("Date of birth").fill("1991-03-14");
  await page.getByLabel("Phone number").fill("555-010-9988");
  await page.getByLabel("Mailing address").fill("77 Birchwood Ave");
  await page.getByLabel("City").fill("Springfield");
  await page.getByLabel("State or region").fill("WA");
  await page.getByLabel("Postal code").fill("98103");
  await page.getByRole("button", { name: "Save and Continue" }).click();

  await page.waitForURL(/\/participant$/, { timeout: 20_000 });
  await expect(page.getByText(/thanks, synthetic/i)).toBeVisible();

  // Returning applicant: onboarding is complete, so the page bounces home.
  await page.goto("/participant/onboarding");
  await page.waitForURL(/\/participant$/, { timeout: 20_000 });
});
