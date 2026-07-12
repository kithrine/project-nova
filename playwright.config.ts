import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const LOCAL_URL = `http://localhost:${PORT}`;

// In CI, tests run against the deployed Vercel preview instead of a local
// dev server (Story 1.6): PLAYWRIGHT_BASE_URL carries the preview URL and
// no webServer is started.
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  // Clerk dev instances rate-limit; too many concurrent sign-ins makes the
  // suite flaky. Four workers keeps FAPI traffic under the limit locally.
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: externalBaseUrl ?? LOCAL_URL,
    trace: "on-first-retry",
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
