/**
 * Synthetic E2E test user (Story 1.2). The +clerk_test email subaddress marks
 * this as a Clerk test-mode identity in the development instance — no real
 * email is ever sent. This is NOT a secret: the account exists only in the
 * nonproduction Clerk instance, holds no memberships, and server-side
 * authorization denies it everything beyond the signed-in placeholder.
 * Override via env if desired.
 */
export const E2E_USER_EMAIL =
  process.env.E2E_CLERK_USER_EMAIL ?? "e2e+clerk_test@example.com";

export const E2E_USER_PASSWORD =
  process.env.E2E_CLERK_USER_PASSWORD ?? "Synthetic-Nova-E2E-42!";
