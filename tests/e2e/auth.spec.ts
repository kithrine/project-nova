import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

import { E2E_USER_EMAIL } from "./test-user";
import { signIn } from "./sign-in";

/**
 * Authentication boundary (Story 1.2).
 */

test("an unauthenticated visitor is redirected from a protected route to sign-in", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.waitForURL(/sign-in/);
  expect(page.url()).toContain("/sign-in");
});

test("the sign-in page renders the authentication form", async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-in");
  // Clerk's widget renders a form with an identifier input.
  await expect(page.locator(".cl-rootBox, [data-clerk-component]").first()).toBeVisible({
    timeout: 15_000,
  });
});

test("a user can sign in and reach the authenticated placeholder page", async ({ page }) => {
  // This Clerk instance signs in via email code (password is not a first
  // factor). The +clerk_test address is a test-mode identity, so the dev
  // instance accepts the fixed verification code automatically.
  await signIn(page, E2E_USER_EMAIL);

  // /dashboard is the role router (Story 1.7): this user holds a shelter
  // membership, so it redirects to the shelter shell.
  await page.goto("/dashboard");
  await page.waitForURL(/\/shelter/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "Shelter workspace" }),
  ).toBeVisible({ timeout: 15_000 });
});
