import { expect, test } from "@playwright/test";

import { E2E_USER_EMAIL } from "./test-user";
import { signIn } from "./sign-in";

/**
 * Cross-organization authorization (Story 1.5). The E2E user is a Shelter
 * Supervisor at the synthetic "e2e_org_shelter" organization ONLY. The
 * seeded "seed_org_shelter" belongs to a different organization — reaching
 * it must be denied server-side.
 */
test.beforeEach(async ({ page }) => {
  await signIn(page, E2E_USER_EMAIL);
});

test("a shelter user can read their own organization's summary", async ({ page }) => {
  const response = await page.request.get("/api/organizations/e2e_org_shelter/summary");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.id).toBe("e2e_org_shelter");
  expect(body.name).toContain("E2E Test Shelter");
  // Shaped response only — no raw record fields.
  expect(body.isSynthetic).toBeUndefined();
  expect(body.createdAt).toBeUndefined();
});

test("cross-organization access is denied server-side", async ({ page }) => {
  const response = await page.request.get("/api/organizations/seed_org_shelter/summary");
  expect(response.status()).toBe(403);
  const body = await response.json();
  expect(body.error.code).toBe("AUTHORIZATION");
  // No data about the other organization leaks in the denial.
  expect(JSON.stringify(body)).not.toContain("Sunny Paws");
});

test("a missing organization is reported as not found, not leaked", async ({ page }) => {
  const response = await page.request.get("/api/organizations/does_not_exist/summary");
  expect(response.status()).toBe(404);
});
