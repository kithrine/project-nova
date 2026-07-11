/**
 * Synthetic E2E test users (Stories 1.2/1.5/1.7). The +clerk_test email
 * subaddress marks these as Clerk test-mode identities in the development
 * instance — no real email is ever sent, and sign-in uses the fixed test
 * verification code. These are NOT secrets: the accounts exist only in the
 * nonproduction Clerk instance and hold only synthetic memberships.
 * Override via env if desired.
 */

/** Shelter Supervisor at e2e_org_shelter. */
export const E2E_USER_EMAIL =
  process.env.E2E_CLERK_USER_EMAIL ?? "e2e+clerk_test@example.com";

/** Program Coordinator at e2e_org_nova (operations experience). */
export const E2E_OPS_USER_EMAIL =
  process.env.E2E_CLERK_OPS_USER_EMAIL ?? "e2e-ops+clerk_test@example.com";

/** Participant (no staff memberships). */
export const E2E_PARTICIPANT_USER_EMAIL =
  process.env.E2E_CLERK_PARTICIPANT_USER_EMAIL ?? "e2e-participant+clerk_test@example.com";

export const E2E_USER_PASSWORD =
  process.env.E2E_CLERK_USER_PASSWORD ?? "Synthetic-Nova-E2E-42!";
