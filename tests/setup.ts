import "@testing-library/jest-dom/vitest";
import { loadEnvConfig } from "@next/env";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Load .env / .env.local exactly the way Next.js does, so integration tests
// see DATABASE_URL without a separate dotenv dependency.
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

// React Testing Library only auto-cleans when a global afterEach exists
// (vitest globals are off in this project), so register cleanup explicitly.
afterEach(() => {
  cleanup();
});
