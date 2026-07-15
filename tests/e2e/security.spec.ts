import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";
import {
  E2E_OTHER_MANAGER_USER_EMAIL,
  E2E_USER_EMAIL,
} from "./test-user";

/**
 * Story 7.8 — the "cross-shelter access is denied" journey
 * (docs/architecture/testing-strategy.md) plus the webhook boundary.
 * Read-only; parallel-safe. The service-level battery lives in
 * tests/integration/security-boundaries.test.ts.
 */

test("a shelter user cannot reach another organization's placement or hours (7.8)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  // The OTHER organization's manager tries Harper's placement (org A) by
  // direct URL on every surface a shelter has.
  await signIn(page, E2E_OTHER_MANAGER_USER_EMAIL);

  await page.goto("/shelter/placements/e2e_placement_hours");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible({ timeout: 20_000 });

  await page.goto("/shelter/placements/e2e_placement_hours?tab=hours");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();

  // Their own placements list never mentions org A's participant.
  await page.goto("/shelter/placements");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Harper Synthetic-Hours/)).toHaveCount(0);
});

test("a shelter surface never exposes applications, background, or case notes (7.8)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_USER_EMAIL);

  // The supervisor's own placement view: sensitive sections are absent
  // from the rendered content, not merely hidden (page.content() would
  // false-positive on the word "background" inside Tailwind's CSS).
  await page.goto("/shelter/placements/e2e_placement_hours");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 20_000,
  });
  const text = (await page.locator("body").innerText()).toLowerCase();
  expect(text).not.toContain("case note");
  expect(text).not.toContain("background");

  // Operations application surfaces are a different experience entirely.
  await page.goto("/operations/applications");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();
});

test("an unsigned Clerk webhook is rejected without detail (7.8)", async ({
  request,
}) => {
  const response = await request.post("/api/webhooks/clerk", {
    data: { type: "user.created", data: { id: "forged" } },
  });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body).toEqual({ error: "invalid signature" });
});
