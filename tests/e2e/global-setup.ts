import { loadEnvConfig } from "@next/env";
import { clerkSetup } from "@clerk/testing/playwright";

import { E2E_USER_EMAIL, E2E_USER_PASSWORD } from "./test-user";

/**
 * Playwright global setup (Story 1.2):
 *  1. Load env the Next.js way (Clerk keys live in .env.local).
 *  2. Obtain a Clerk testing token so E2E sign-in bypasses bot protection.
 *  3. Ensure the synthetic test user exists in the dev Clerk instance.
 */
export default async function globalSetup() {
  loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

  await clerkSetup();

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required for E2E auth tests (.env.local)");
  }

  const response = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [E2E_USER_EMAIL],
      password: E2E_USER_PASSWORD,
      first_name: "Synthetic",
      last_name: "E2E",
      skip_password_checks: true,
    }),
  });

  // 200 = created. 422 is acceptable ONLY when the user already exists —
  // other 422s (e.g. invalid email) must fail loudly, or sign-in tests
  // would later fail with a misleading "Identifier is invalid".
  if (!response.ok) {
    const body = await response.text();
    const alreadyExists = response.status === 422 && body.includes("form_identifier_exists");
    if (!alreadyExists) {
      throw new Error(`Failed to ensure E2E test user (${response.status}): ${body}`);
    }
  }
}
