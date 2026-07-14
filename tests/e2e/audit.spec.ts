import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";
import { E2E_GRANT_ADMIN_USER_EMAIL, E2E_OPS_USER_EMAIL } from "./test-user";

/**
 * Story 7.6 — Audit review. Read-only journeys over the append-only
 * trail; the provisioning anchor event (subject e2e_audit_anchor) makes
 * the assertions deterministic while other specs write their own events
 * concurrently.
 */

test("grant administrator reviews and filters audit events (7.6)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_GRANT_ADMIN_USER_EMAIL);

  await page.goto("/operations/administration");
  await page.getByRole("link", { name: "Audit review" }).click();
  await expect(page.getByRole("heading", { name: "Audit review" })).toBeVisible();

  // The anchor event renders with actor, action, resource, and detail.
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const anchorRow = table.locator("tbody tr", { hasText: "e2e_audit_anchor" });
  await expect(anchorRow).toContainText("timesheet.lock");
  await expect(anchorRow).toContainText("final for reporting: 12.34 hours");

  // Filtering by action narrows the list and keeps the anchor visible.
  const filters = page.getByRole("form", { name: "Audit filters" });
  await filters.getByLabel("Action").selectOption("timesheet.lock");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL(/action=timesheet\.lock/);
  await expect(
    page.getByRole("table").locator("tbody tr", { hasText: "e2e_audit_anchor" }),
  ).toBeVisible();
  await expect(page.getByText(/\d+ audit events?/)).toBeVisible();
});

test("a coordinator cannot open audit review — the trail is its own privilege (7.6)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_OPS_USER_EMAIL);

  await page.goto("/operations/administration/audit");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();
});
