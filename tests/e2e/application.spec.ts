import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

import { E2E_DRAFT_USER_EMAIL } from "./test-user";

/**
 * Draft application journey (Story 2.3). Uses its OWN resettable identity —
 * spec files run in parallel, so sharing a mutable user with onboarding.spec
 * would race. Serial within the file: one continuous journey.
 */
test.describe.configure({ mode: "serial" });

async function signInAsApplicant(page: Page) {
  await page.goto("/sign-in");
  await clerk.signIn({
    page,
    signInParams: { strategy: "email_code", identifier: E2E_DRAFT_USER_EMAIL },
  });
  await page.waitForFunction(
    () => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user),
    undefined,
    { timeout: 15_000 },
  );
}

/** Complete onboarding if this identity hasn't yet (idempotent across specs). */
async function ensureOnboarded(page: Page) {
  await page.goto("/participant/application");
  if (page.url().includes("/participant/onboarding")) {
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
    await page.goto("/participant/application");
  }
}

test("an applicant starts a draft and saves partial answers", async ({ page }) => {
  await signInAsApplicant(page);
  await ensureOnboarded(page);

  await expect(page.getByRole("heading", { level: 1, name: "My Application" })).toBeVisible();
  await page.getByRole("button", { name: "Start Your Application" }).click();

  // The draft form appears with its application number and progress bar.
  await expect(page.getByText(/APP-\d{4}-/)).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("progressbar", { name: "Application progress" }),
  ).toBeVisible();

  await page
    .getByLabel("Why do you want to join Project Nova?")
    .fill("I want steady work and a team.");
  await page.getByRole("button", { name: "Save Draft" }).click();
  await expect(page.getByRole("status")).toHaveText(/draft saved/i, { timeout: 15_000 });
});

test("the draft survives sign-out and resumes on the next visit", async ({ page }) => {
  await signInAsApplicant(page);
  await page.goto("/participant/application");

  // Same draft, same saved answer — no duplicate started.
  await expect(page.getByLabel("Why do you want to join Project Nova?")).toHaveValue(
    "I want steady work and a team.",
    { timeout: 20_000 },
  );
  await expect(page.getByText(/APP-\d{4}-/)).toBeVisible();

  // Sign out; the protected page locks again.
  await clerk.signOut({ page });
  await page.goto("/participant/application");
  await page.waitForURL(/sign-in/, { timeout: 20_000 });

  // Sign back in: the very same draft is waiting.
  await signInAsApplicant(page);
  await page.goto("/participant/application");
  await expect(page.getByLabel("Why do you want to join Project Nova?")).toHaveValue(
    "I want steady work and a team.",
    { timeout: 20_000 },
  );
});
