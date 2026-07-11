import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React Testing Library only auto-cleans when a global afterEach exists
// (vitest globals are off in this project), so register cleanup explicitly.
afterEach(() => {
  cleanup();
});
