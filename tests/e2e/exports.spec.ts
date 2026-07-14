import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

import { signIn } from "./sign-in";
import { E2E_GRANT_ADMIN_USER_EMAIL, E2E_OPS_USER_EMAIL } from "./test-user";

/**
 * Story 7.5 — Scoped exports, plus the export-audit journey Story 7.6
 * deferred: a permitted user downloads a named export, and the run
 * appears in Audit review. Exports are read-only over report data, so
 * these tests are parallel-safe.
 */

test("grant administrator exports the shelter roster and the run is audited (7.5 + 7.6)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_GRANT_ADMIN_USER_EMAIL);

  await page.goto("/operations/reports");
  await page.getByRole("link", { name: "Exports" }).click();
  await expect(page.getByRole("heading", { name: "Exports" })).toBeVisible();

  // The confirmation step: open the disclosure, see the fixed field set
  // and the audit notice, then download.
  const roster = page.locator("li", { hasText: "Shelter roster" }).first();
  await roster.locator("summary").click();
  await expect(roster.getByText("This export contains exactly these fields:")).toBeVisible();
  await expect(roster.getByText(/records an audit event/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await roster.getByRole("link", { name: "Download Shelter roster" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^nova-shelter-roster-\d{4}-\d{2}-\d{2}\.csv$/);

  const path = await download.path();
  const csv = await readFile(path, "utf8");
  const [header] = csv.split("\r\n");
  expect(header).toBe(
    "Organization,Site,Site capacity,Active placements,Managers,Supervisors",
  );
  expect(csv).toContain("E2E Test Shelter (Synthetic)");
  // Restricted contents never appear (AC3).
  expect(csv).not.toMatch(/background|case ?note|narrative/i);

  // The export is now a reviewable audit event (7.6's deferred journey).
  await page.goto("/operations/administration/audit");
  const filters = page.getByRole("form", { name: "Audit filters" });
  await filters.getByLabel("Action").selectOption("report.export");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL(/action=report\.export/);
  const exportRow = page
    .getByRole("table")
    .locator("tbody tr", { hasText: "shelter-roster" })
    .first();
  await expect(exportRow).toContainText("report.export");
  await expect(exportRow).toContainText("Shelter roster");
});

test("a coordinator cannot reach exports and no file is produced (7.5)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_OPS_USER_EMAIL);

  await page.goto("/operations/reports/exports");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();

  // The Route Handler denies directly too — no CSV comes back.
  const response = await page.request.get("/api/exports/shelter-roster");
  expect(response.status()).toBeGreaterThanOrEqual(403);
  expect(response.headers()["content-type"] ?? "").not.toContain("text/csv");
});
