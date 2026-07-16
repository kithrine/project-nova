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
    ["deep teal primary", "--color-primary: #0f6b5c"],
    ["electric chartreuse accent", "--color-accent: #d9e021"],
    ["dark-on-accent content", "--color-accent-content: #1f2a05"],
    ["calm green success", "--color-success: #147a3a"],
    ["amber warning", "--color-warning: #a84d08"],
    ["muted red danger", "--color-error: #b91c1c"],
    ["warm cream surface", "--color-base-100: #faf6ec"],
    ["spruce ink text", "--color-base-content: #0b1712"],
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
