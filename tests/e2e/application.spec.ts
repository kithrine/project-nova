import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

import { E2E_DRAFT_USER_EMAIL } from "./test-user";

/**
 * Application journey, draft through submission (Stories 2.3, 2.5). Uses its
 * OWN resettable identity — spec files run in parallel, so sharing a mutable
 * user with onboarding.spec would race. Serial within the file: one
 * continuous journey.
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

test("uploading a required document updates the checklist (Story 2.4)", async ({ page }) => {
  await signInAsApplicant(page);
  await page.goto("/participant/application");

  // The required item starts missing.
  await expect(page.getByText(/missing — please upload this document/i)).toBeVisible({
    timeout: 20_000,
  });

  // Standard file picker (keyboard-first, no drag-and-drop required).
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  await page
    .locator("#upload-GOVERNMENT_ID")
    .setInputFiles({ name: "id-front.png", mimeType: "image/png", buffer: png });

  // Direct upload -> server-verified confirm -> checklist refresh.
  await expect(page.getByText(/uploaded: id-front/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "View" })).toBeVisible();
  await expect(page.getByText(/missing — please upload this document/i)).toBeHidden();
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

test("submit unlocks only when complete, then confirms and freezes (Story 2.5)", async ({
  page,
}) => {
  await signInAsApplicant(page);
  await page.goto("/participant/application");

  // Four answers are still blank, so Submit is disabled — with the reason
  // and each missing item linked to its field.
  const submitButton = page.getByRole("button", { name: "Submit Application" });
  await expect(submitButton).toBeDisabled({ timeout: 20_000 });
  await expect(page.getByText(/4 items left to finish/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Work or volunteer experience" }),
  ).toHaveAttribute("href", "#workExperience");

  // Finish the remaining answers and save.
  await page.getByLabel("Work or volunteer experience").fill("Warehouse shifts.");
  await page.getByLabel("Experience with animals").fill("Grew up with dogs.");
  await page.getByLabel("When are you available to work?").fill("Weekday mornings.");
  await page
    .getByLabel("How would you get to a shelter site?")
    .fill("Bus line 7, or a ride.");
  await page.getByRole("button", { name: "Save Draft" }).click();
  await expect(page.getByRole("status")).toHaveText(/draft saved/i, { timeout: 15_000 });

  // The panel refreshes from the server: everything complete, Submit unlocks.
  await expect(submitButton).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByText(/Ready when you are/i)).toBeVisible();

  // Submit — the respectful confirmation appears, announced as a status.
  await submitButton.click();
  await page.waitForURL(/submitted=1/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: /Your application is submitted/i }),
  ).toBeVisible();
  await expect(page.getByText(/what happens next/i)).toBeVisible();

  // The form is gone; the submitted answers are read-only.
  await expect(page.getByRole("button", { name: "Submit Application" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Save Draft" })).toBeHidden();
  await page.getByText("Your submitted answers").click();
  await expect(page.getByText("I want steady work and a team.")).toBeVisible();

  // A fresh visit shows in-review — still exactly one application, no way
  // to submit again (the replay path is covered at the service layer).
  await page.goto("/participant/application");
  await expect(page.getByText("Submitted", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("button", { name: "Submit Application" })).toBeHidden();
});
