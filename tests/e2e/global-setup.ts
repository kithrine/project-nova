import { execFileSync } from "node:child_process";

import { loadEnvConfig } from "@next/env";
import { clerkSetup } from "@clerk/testing/playwright";

/**
 * Playwright global setup (Stories 1.2/1.5):
 *  1. Load env the Next.js way (Clerk keys live in .env.local).
 *  2. Obtain a Clerk testing token so E2E sign-in bypasses bot protection.
 *  3. Provision fixtures via tsx — the generated Prisma client is ESM-first
 *     and cannot be imported from Playwright's CJS-transpiled setup, so the
 *     database work runs in tests/e2e/provision-fixtures.mts (the same
 *     pattern as prisma/seed.mts).
 */
export default async function globalSetup() {
  loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

  // Smoke-only mode (CI, Story 1.6): the smoke + a11y specs need no Clerk
  // session and no database fixtures, so skip both.
  if (process.env.E2E_SMOKE_ONLY === "1") {
    return;
  }

  await clerkSetup();

  // No shell involved: run tsx's CLI entry directly under the current Node
  // binary (execFile + static args, per security guidance).
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "tests/e2e/provision-fixtures.mts"],
    { stdio: "inherit", env: process.env },
  );
}
