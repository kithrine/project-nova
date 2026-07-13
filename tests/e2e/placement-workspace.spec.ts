import { expect, test } from "@playwright/test";

import {
  E2E_GRANT_ADMIN_USER_EMAIL,
  E2E_OPS_USER_EMAIL,
  E2E_OTHER_MANAGER_USER_EMAIL,
  E2E_PARTICIPANT_USER_EMAIL,
  E2E_USER_EMAIL,
} from "./test-user";
import { signIn } from "./sign-in";

/**
 * Placement workspace (Story 5.1): the same fixture placement renders
 * three role-shaped views — full for Operations, no Case Notes for the
 * shelter, plain-language My Placement for the participant — and a
 * cross-organization shelter user is denied.
 */

test("a coordinator gets the full nine-tab workspace (AC1)", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page, E2E_OPS_USER_EMAIL);

  // Story 5.5: the Operations dashboard's Urgent blockers surface flags
  // placements at the activation gate — Parker's onboarding placement
  // always has open prerequisites in the fixture set.
  await page.goto("/operations");
  const urgent = page.getByRole("list", { name: "Urgent blockers" });
  await expect(urgent).toBeVisible({ timeout: 20_000 });
  await expect(
    urgent.locator("li", { hasText: "Parker Synthetic-Participant" }),
  ).toBeVisible();

  await page.goto("/operations/placements");

  await page
    .getByRole("link", { name: "Open placement: Parker Synthetic-Participant" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: /Parker Synthetic-Participant at E2E Test Shelter \(Synthetic\)/,
    }),
  ).toBeVisible({ timeout: 20_000 });

  // Header identity + the lifecycle timeline with the current stage.
  await expect(page.getByText("Placement PLC-E2E-PARKER1")).toBeVisible();
  const timeline = page.getByRole("list", { name: "Placement lifecycle" });
  await expect(timeline.getByText("Onboarding")).toBeVisible();
  await expect(timeline.getByText("(current stage)")).toBeVisible();

  // All nine tabs, Case Notes included for Nova (AC1).
  for (const label of [
    "Overview",
    "Schedule",
    "Hours",
    "Evaluations",
    "Incidents",
    "Case Notes",
    "Documents",
    "Funding",
    "History",
  ]) {
    await expect(page.getByRole("tab", { name: label })).toBeVisible();
  }

  // History shows the lifecycle trail with actors.
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText(/Approved → .*Onboarding/)).toBeVisible({
    timeout: 20_000,
  });

  // Story 5.9 — the coordinator adds an internal note and edits it; the
  // prior version is preserved and disclosed, never overwritten.
  await page.getByRole("tab", { name: "Case Notes" }).click();
  await expect(
    page.getByText(/visible to Nova Operations only/),
  ).toBeVisible({ timeout: 20_000 });
  await page
    .getByLabel("New internal note")
    .fill("Internal E2E coordination note — bus routes.");
  await page.getByRole("button", { name: "Add Note" }).click();
  await expect(
    page.getByText("Internal E2E coordination note — bus routes.").first(),
  ).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Edit Note" }).first().click();
  await page
    .getByLabel("Edit note")
    .fill("Internal E2E coordination note — bus routes confirmed.");
  await page.getByRole("button", { name: "Save Edit" }).click();
  await expect(
    page.getByText(/Edited \(\d+ earlier versions?\)/).first(),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByText("Show earlier versions").first().click();
  await expect(
    page.getByText("Internal E2E coordination note — bus routes.").first(),
  ).toBeVisible();
});

test("a shelter user sees the workspace without Case Notes (AC2)", async ({ page }) => {
  await signIn(page, E2E_USER_EMAIL);
  await page.goto("/shelter/placements");

  await page.getByRole("link", { name: /Parker Synthetic-Participant/ }).click();
  await expect(
    page.getByRole("heading", {
      name: /Parker Synthetic-Participant at E2E Test Shelter \(Synthetic\)/,
    }),
  ).toBeVisible({ timeout: 20_000 });

  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Case Notes" })).toHaveCount(0);
  await expect(page.getByText("Case Notes")).toHaveCount(0);
  // Story 5.9: the coordinator's note content is nowhere in the shelter
  // view — and a direct visit to the OPERATIONS url is denied by the
  // operations layout outright, so notes stay unreachable (AC2).
  await expect(page.getByText(/bus routes/)).toHaveCount(0);
  await page.goto("/operations/placements/records/e2e_placement_participant");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/bus routes/)).toHaveCount(0);
});

test("a cross-organization shelter manager is denied (AC5)", async ({ page }) => {
  await signIn(page, E2E_OTHER_MANAGER_USER_EMAIL);
  await page.goto("/shelter/placements/e2e_placement_participant");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible({ timeout: 20_000 });
});

test("the participant sees My Placement in plain language (AC3)", async ({ page }) => {
  await signIn(page, E2E_PARTICIPANT_USER_EMAIL);
  await page.goto("/participant/placement");

  await expect(
    page.getByRole("heading", { level: 1, name: "My Placement" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Getting ready to start")).toBeVisible();
  await expect(
    page.getByText(/E2E Test Shelter \(Synthetic\) — Main Site \(Synthetic\)/),
  ).toBeVisible();
  await expect(page.getByText("PLC-E2E-PARKER1")).toBeVisible();
  // Plain language only — no internal tab shell, no case notes, no codes.
  await expect(page.getByText(/Case Notes|ONBOARDING|blocker/)).toHaveCount(0);
  // Story 5.9: the coordinator's internal note never reaches My Placement.
  await expect(page.getByText(/bus routes/)).toHaveCount(0);

  // Story 5.4 (AC3): the participant completes their own step before day
  // one. Completion is one-way, so a retry asserts the done state.
  await expect(
    page.getByRole("heading", { name: "Your steps before day one" }),
  ).toBeVisible();
  const markDone = page.getByRole("button", {
    name: "Mark Done: Acknowledge the site safety procedures",
  });
  if (await markDone.isVisible().catch(() => false)) {
    await markDone.click();
  }
  await expect(page.getByText("Done — thank you!")).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/All your steps are done — wonderful/),
  ).toBeVisible();
});

test("a Grant Administrator assigns, ends, and replaces funding (Story 5.3)", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signIn(page, E2E_GRANT_ADMIN_USER_EMAIL);
  await page.goto(
    "/operations/placements/records/e2e_placement_participant?tab=funding",
  );
  await expect(
    page.getByRole("heading", { name: /Parker Synthetic-Participant/ }),
  ).toBeVisible({ timeout: 20_000 });

  // Phase 1 — assign (skipped on retry if an assignment already exists).
  const sourceSelect = page.getByLabel("Funding source");
  if (await sourceSelect.isVisible().catch(() => false)) {
    await sourceSelect.selectOption({ label: "E2E Grant Fund (Synthetic)" });
    await page.getByLabel("Effective start date").fill("2026-08-01");
    await page.getByLabel(/Hourly rate/).fill("18.50");
    await page.getByRole("button", { name: "Assign Funding" }).click();
  }
  const list = page.getByRole("list", { name: "Funding assignments" });
  await expect(
    list.getByText("E2E Grant Fund (Synthetic)").first(),
  ).toBeVisible({ timeout: 20_000 });
  await expect(list.getByText("Active")).toBeVisible();
  await expect(list.getByText(/\$18\.5\/hr/)).toBeVisible();

  // Phase 2 — end it (ADR-010: end before a replacement can be active).
  const endDate = page.getByLabel("End date");
  if (await endDate.isVisible().catch(() => false)) {
    await endDate.fill("2026-09-30");
    await page.getByRole("button", { name: "End Assignment" }).click();
    await expect(list.getByText("Ended").first()).toBeVisible({ timeout: 20_000 });
  }

  // Phase 3 — replace: exactly one active again, history keeps the ended one.
  if (await sourceSelect.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await sourceSelect.selectOption({ label: "E2E Grant Fund (Synthetic)" });
    await page.getByLabel("Effective start date").fill("2026-10-01");
    await page.getByRole("button", { name: "Assign Funding" }).click();
  }
  await expect(list.getByText("Active")).toBeVisible({ timeout: 20_000 });
  await expect(list.getByText("Ended").first()).toBeVisible();
});

test("a coordinator converts a placement to permanent employment (Story 5.8)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/placements/records/e2e_placement_convert");
  await expect(
    page.getByRole("heading", { name: /Rowan Synthetic-Convert/ }),
  ).toBeVisible({ timeout: 20_000 });

  // Phase-guarded for retries: converting is one-way, so a rerun lands
  // straight on the converted state.
  const recordHire = page.getByRole("button", { name: "Record Permanent Hire…" });
  await expect(
    page.getByText(/Stage: .*(Active|Converted to permanent employment)/),
  ).toBeVisible({ timeout: 20_000 });
  if (await recordHire.isVisible().catch(() => false)) {
    await recordHire.click();
    await expect(
      page.getByText(/creates the Employment Outcome record/i),
    ).toBeVisible();
    // Employer prefills with the host organization.
    await expect(page.getByLabel("Hired by")).toHaveValue(
      "E2E Test Shelter (Synthetic)",
    );
    await page.getByLabel("Job title (optional)").fill("Kennel technician");
    await page.getByRole("button", { name: "Yes, Record Permanent Hire" }).click();
  }
  await expect(
    page.getByText(/Stage: .*Converted to permanent employment/),
  ).toBeVisible({ timeout: 20_000 });
  // The Employment Outcome surfaces on the Overview tab (AC2).
  await expect(
    page.getByText(/Hired by E2E Test Shelter \(Synthetic\) on .* — Kennel technician/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Record Permanent Hire…" })).toHaveCount(0);
});

test("the workspace stays usable at 360px with no horizontal page scroll (AC6)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/placements/records/e2e_placement_participant");

  await expect(
    page.getByRole("heading", { name: /Parker Synthetic-Participant/ }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
