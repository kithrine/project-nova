import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const LOCAL_URL = `http://localhost:${PORT}`;

// In CI, tests run against the deployed Vercel preview instead of a local
// dev server (Story 1.6): PLAYWRIGHT_BASE_URL carries the preview URL and
// no webServer is started.
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

// With Vercel Deployment Protection re-enabled at launch (Story 7.9,
// runbook phase 9), preview URLs are auth-gated; CI authenticates with
// the project's Protection Bypass for Automation secret. Unset locally
// and against the public production domain — no header is sent then.
const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  // Clerk dev instances rate-limit (429s); too much concurrency makes the
  // suite flaky. Three workers still burst past the limit: beyond sign-ins,
  // every open context refreshes its session token via FAPI (~every 50s),
  // and a throttled refresh kills the session mid-journey — the browser
  // lands back on /sign-in with no server-side auth redirect in the logs.
  // Two workers (the CI value) keeps sign-in plus refresh traffic under
  // the limit.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: externalBaseUrl ?? LOCAL_URL,
    trace: "on-first-retry",
    ...(protectionBypass
      ? {
          extraHTTPHeaders: {
            "x-vercel-protection-bypass": protectionBypass,
          },
        }
      : {}),
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run dev",
        url: LOCAL_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
