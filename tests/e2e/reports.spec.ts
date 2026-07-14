import { expect, test } from "@playwright/test";

import { signIn } from "./sign-in";
import {
  E2E_GRANT_ADMIN_USER_EMAIL,
  E2E_OPS_USER_EMAIL,
  E2E_SHELTER_MANAGER_USER_EMAIL,
} from "./test-user";

/**
 * Story 7.1 — Active placement summary. Read-only journeys: no fixture
 * data is mutated, so these tests are safe under full parallelism.
 * Assertions anchor on structure (headings, table, count line) rather
 * than exact fixture names — other specs create and transition their own
 * placements concurrently, so row totals are never assumed.
 */

test("coordinator opens the reports area and filters the active placement summary (7.1)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_OPS_USER_EMAIL);

  // Reports is now a real navigation destination (Story 7.1 flips it on).
  await page.goto("/operations/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

  await page.getByRole("link", { name: "Active placement summary" }).click();
  await expect(
    page.getByRole("heading", { name: "Active placement summary" }),
  ).toBeVisible();

  // The live count and the table render; Harper's ACTIVE fixture placement
  // guarantees at least one in-progress row.
  await expect(page.getByText(/\d+ in-progress placements?/)).toBeVisible();
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /participant/i })).toBeVisible();
  expect(await table.locator("tbody tr").count()).toBeGreaterThanOrEqual(1);

  // Filtering by stage narrows the list: every remaining stage cell reads
  // Active, and the URL carries the filter.
  await page.getByLabel("Lifecycle stage").selectOption("ACTIVE");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.waitForURL(/stage=ACTIVE/);
  await expect(page.getByText(/\d+ in-progress placements?/)).toBeVisible();
  const stageCells = page.getByRole("table").locator("tbody tr td:nth-child(6)");
  const stageCount = await stageCells.count();
  expect(stageCount).toBeGreaterThanOrEqual(1);
  for (let i = 0; i < stageCount; i++) {
    await expect(stageCells.nth(i)).toHaveText(/Active/);
  }

  // Clearing filters returns to the unfiltered report.
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/active-placements$/);
});

test("a shelter user cannot reach the operations reports area (7.1 organization boundary)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_SHELTER_MANAGER_USER_EMAIL);

  await page.goto("/operations/reports/active-placements");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();
});

test("coordinator reviews the shelter roster across organizations (7.3)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_OPS_USER_EMAIL);

  await page.goto("/operations/reports");
  await page.getByRole("link", { name: "Shelter roster" }).click();
  await expect(page.getByRole("heading", { name: "Shelter roster" })).toBeVisible();

  // Nova sees every participating shelter — including the one with no
  // placements, shown with numeric zero counts rather than omitted.
  const roster = page.getByRole("list", { name: "Participating shelters" });
  await expect(roster.getByText("E2E Test Shelter (Synthetic)")).toBeVisible();
  await expect(roster.getByText("E2E Other Shelter (Synthetic)")).toBeVisible();
  await expect(roster.getByText(/\d+ active of \d+ capacity/).first()).toBeVisible();
});

test("shelter manager's Organization page shows only their own shelter (7.3)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_SHELTER_MANAGER_USER_EMAIL);

  await page.goto("/shelter/organization");
  await expect(page.getByRole("heading", { name: "Organization" })).toBeVisible();

  const roster = page.getByRole("list", { name: "Participating shelters" });
  await expect(roster.getByText("E2E Test Shelter (Synthetic)")).toBeVisible();
  // Organization scope: the other shelter never appears.
  await expect(roster.getByText("E2E Other Shelter (Synthetic)")).toHaveCount(0);
});

test("coordinator reads exact outcome counts for the fixture period (7.4)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_OPS_USER_EMAIL);

  await page.goto("/operations/reports");
  await page.getByRole("link", { name: "Outcome summary" }).click();
  await expect(page.getByRole("heading", { name: "Outcome summary" })).toBeVisible();
  await expect(page.getByText("Program to date.")).toBeVisible();

  // February 2026 holds exactly one fixture outcome (Harper's COMPLETED
  // placement, endDate 2026-02-10) and one fixture credential — no
  // journey spec writes terminal outcomes into that period.
  const periodForm = page.getByRole("form", { name: "Reporting period" });
  await periodForm.getByLabel("From").fill("2026-02-01");
  await periodForm.getByLabel("To").fill("2026-02-28");
  await page.getByRole("button", { name: "Apply period" }).click();
  await page.waitForURL(/from=2026-02-01/);

  const cards = page.getByRole("list", { name: "Outcome counts" });
  await expect(
    cards.locator("li", { hasText: "Completed" }).getByText("1", { exact: true }),
  ).toBeVisible();
  await expect(
    cards.locator("li", { hasText: "Credentials earned" }).getByText("1", { exact: true }),
  ).toBeVisible();
  // Zero-count outcomes render as cards rather than disappearing.
  await expect(
    cards.locator("li", { hasText: "Withdrawn" }).getByText("0", { exact: true }),
  ).toBeVisible();
});

test("grant administrator sees locked hours under the correct funding source with an exact total (7.2)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await signIn(page, E2E_GRANT_ADMIN_USER_EMAIL);

  await page.goto("/operations/reports");
  await page.getByRole("link", { name: "Approved hours by funding source" }).click();
  await expect(
    page.getByRole("heading", { name: "Approved hours by funding source" }),
  ).toBeVisible();

  // The ADR-020 provisional flag is part of the report, in every state.
  await expect(page.getByRole("note", { name: "Provisional format notice" })).toBeVisible();

  // Harper's fixture week (2026-01-05, LOCKED, 12.34 hours) sits in a
  // period no other spec touches, so the figure is deterministic. Scope
  // to the named form: the bare label "To" also matches the dev overlay's
  // "Open Next.js Dev Tools" button under strict mode.
  const periodForm = page.getByRole("form", { name: "Reporting period" });
  await periodForm.getByLabel("From").fill("2026-01-01");
  await periodForm.getByLabel("To").fill("2026-01-31");
  await page.getByRole("button", { name: "Apply period" }).click();
  await page.waitForURL(/from=2026-01-01/);

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const grantRow = table.locator("tbody tr", { hasText: "E2E Grant Fund (Synthetic)" });
  await expect(grantRow).toContainText("E2E-GRANT");
  await expect(grantRow).toContainText("12.34");
});
