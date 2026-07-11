import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Story 1.1 — design tokens resolve the expected values.
 * Color tokens live in the DaisyUI "nova" theme (src/app/globals.css);
 * non-color tokens live in src/styles/tokens.css.
 */
const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf-8");
const tokensCss = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf-8");

describe("nova color theme (globals.css)", () => {
  it.each([
    ["deep blue primary", "--color-primary: #1d4ed8"],
    ["muted teal accent", "--color-accent: #0f766e"],
    ["calm green success", "--color-success: #15803d"],
    ["amber warning", "--color-warning: #b45309"],
    ["muted red danger", "--color-error: #b91c1c"],
    ["neutral-first surface", "--color-base-100: #ffffff"],
    ["neutral text", "--color-base-content: #0f172a"],
  ])("defines the %s token", (_name, declaration) => {
    expect(globalsCss).toContain(declaration);
  });

  it("registers the theme as the default DaisyUI theme", () => {
    expect(globalsCss).toContain('name: "nova"');
    expect(globalsCss).toContain("default: true");
  });
});

describe("non-color tokens (tokens.css)", () => {
  it.each([
    ["moderate radius", "--radius-md: 0.375rem"],
    ["minimal shadow", "--shadow-sm:"],
    ["visible focus ring width", "--focus-ring-width: 2px"],
    ["fast motion duration", "--duration-fast: 150ms"],
  ])("defines the %s token", (_name, declaration) => {
    expect(tokensCss).toContain(declaration);
  });

  it("supports reduced motion", () => {
    expect(tokensCss).toContain("prefers-reduced-motion: reduce");
  });
});
