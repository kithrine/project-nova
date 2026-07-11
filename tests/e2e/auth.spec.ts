import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

import { E2E_USER_EMAIL } from "./test-user";

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
  await page.goto("/sign-in");
  // This Clerk instance signs in via email code (password is not a first
  // factor). The +clerk_test address is a test-mode identity, so the dev
  // instance accepts the fixed verification code automatically.
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "email_code",
      identifier: E2E_USER_EMAIL,
    },
  });

  // Wait until the client session actually exists before navigating —
  // setActive finishes writing session cookies slightly after signIn resolves.
  await page.waitForFunction(
    () => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user),
    undefined,
    { timeout: 15_000 },
  );

  await page.goto("/dashboard");
  // Dev-instance auth may bounce through Clerk's handshake redirects first.
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "You're signed in" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("user-email")).toContainText(E2E_USER_EMAIL);
});
