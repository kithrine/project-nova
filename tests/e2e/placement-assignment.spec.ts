import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

import { E2E_OPS_USER_EMAIL, E2E_SHELTER_MANAGER_USER_EMAIL } from "./test-user";
import { signIn } from "./sign-in";

/**
 * Site/supervisor/schedule assignment (Story 5.2): one phase-guarded
 * cycle on the Casey fixture placement — assign the package, propose,
 * shelter requests changes, coordinator revises and re-proposes, the
 * manager approves, and the full history is visible. Retries converge on
 * the Approved end state.
 */

const WORKSPACE = "/operations/placements/records/e2e_placement_assign";

test("the package is assigned, reviewed, revised, and approved (Story 5.2)", async ({
  page,
}) => {
  test.setTimeout(300_000);

  // Phase 1 — the coordinator builds and proposes the package.
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto(`${WORKSPACE}?tab=schedule`);
  await expect(
    page.getByRole("heading", { name: /Casey Synthetic-Assign/ }),
  ).toBeVisible({ timeout: 20_000 });

  if (await page.getByLabel(/^Supervisor/).isVisible().catch(() => false)) {
    await page.getByLabel(/^Supervisor/).selectOption({ value: "e2e_user_shelter" });
    await page
      .getByLabel(/Coordinator of record/)
      .selectOption({ value: "e2e_user_ops" });
    await page.getByLabel("Monday").check();
    await page.getByLabel("Wednesday").check();
    await page.getByLabel("Weekly hours target").fill("8");
    await page.getByRole("button", { name: "Save Package" }).click();
    await expect(page.getByText("Package saved.")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Propose to Shelter" }).click();
    await expect(page.getByText(/Stage: .*Shelter review/)).toBeVisible({
      timeout: 20_000,
    });
  }

  // Phase 2 — the manager returns it with an actionable note.
  await clerk.signOut({ page });
  await signIn(page, E2E_SHELTER_MANAGER_USER_EMAIL);
  await page.goto("/shelter");
  const reviewLink = page.getByRole("link", {
    name: /Review package: Casey Synthetic-Assign/,
  });
  if (await reviewLink.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await reviewLink.click();
    const requestChanges = page.getByRole("button", { name: "Request Changes" });
    if (await requestChanges.isVisible({ timeout: 20_000 }).catch(() => false)) {
      await requestChanges.click();
      await page
        .getByLabel("Note for the coordinator (required)")
        .fill("Mornings are full — please shift to afternoons");
      await page.getByRole("button", { name: "Yes, Request Changes" }).click();
      await expect(page.getByText(/Stage: .*Draft/)).toBeVisible({ timeout: 20_000 });
    }
  }

  // Phase 3 — the coordinator sees the note, revises, and re-proposes.
  await clerk.signOut({ page });
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto(WORKSPACE);
  await expect(
    page.getByRole("heading", { name: /Casey Synthetic-Assign/ }),
  ).toBeVisible({ timeout: 20_000 });
  if (
    await page
      .getByText("The shelter requested changes")
      .isVisible()
      .catch(() => false)
  ) {
    await expect(page.getByText(/please shift to afternoons/)).toBeVisible();
    await page.goto(`${WORKSPACE}?tab=schedule`);
    await page.getByLabel("Weekly hours target").fill("8.5");
    await page.getByRole("button", { name: "Save Package" }).click();
    await expect(page.getByText("Package saved.")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Propose to Shelter" }).click();
    await expect(page.getByText(/Stage: .*Shelter review/)).toBeVisible({
      timeout: 20_000,
    });
  }

  // Phase 4 — the manager approves the revised package (AC4).
  await clerk.signOut({ page });
  await signIn(page, E2E_SHELTER_MANAGER_USER_EMAIL);
  await page.goto("/shelter/placements/e2e_placement_assign");
  const approve = page.getByRole("button", { name: "Approve Package" });
  if (await approve.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await approve.click();
    await page.getByRole("button", { name: "Yes, Approve Package" }).click();
  }
  // Anchor on the exact stage line — the wildcard form once matched more
  // than the header and let a failed approve slip past this guard. Later
  // stages are legal here on a retry that already progressed.
  await expect(
    page.getByText(/· Stage: (Approved|Onboarding|Active|Paused)/),
  ).toBeVisible({ timeout: 20_000 });

  // Full history is visible on the workspace (AC4: actor + timestamps).
  await page.goto("/shelter/placements/e2e_placement_assign?tab=history");
  await expect(page.getByText(/Draft → .*Proposed/).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Shelter review → .*Approved/)).toBeVisible({
    timeout: 20_000,
  });

  // Phase 5 (Story 5.4) — the coordinator initiates placement onboarding:
  // the site-specific task set generates and the placement enters
  // Onboarding. A retry may arrive already Active (Story 5.6 ends there).
  await clerk.signOut({ page });
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto(WORKSPACE);
  const startOnboarding = page.getByRole("button", { name: "Start Onboarding" });
  if (await startOnboarding.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await page
      .getByLabel(/The package is approved and the site is ready/)
      .check();
    await startOnboarding.click();
  }
  await expect(page.getByText(/· Stage: (Onboarding|Active|Paused)/)).toBeVisible({
    timeout: 20_000,
  });

  // Phases 6-8 run only while still Onboarding — the stage line above is
  // server-rendered and settled, so this branch guard is safe (the
  // matching-prologue lesson: never probe during hydration).
  if (await page.getByText(/· Stage: Onboarding/).isVisible().catch(() => false)) {
    // Phase 6 (Story 5.4) — verifying a task drops the remaining count.
    await expect(
      page.getByRole("heading", { name: "Placement onboarding" }),
    ).toBeVisible();
    const progress = page.getByText(
      /required steps? remain|All required steps are complete/,
    );
    await expect(progress.first()).toBeVisible({ timeout: 20_000 });
    if (await page.getByText(/8 required steps remain/).isVisible().catch(() => false)) {
      await page
        .getByRole("button", {
          name: "Mark Done: Site safety and hazard orientation delivered",
        })
        .click();
      await expect(page.getByText(/7 required steps remain/)).toBeVisible({
        timeout: 20_000,
      });
      await expect(
        page.getByText(/Complete .*Synthetic E2E/).first(),
      ).toBeVisible({ timeout: 20_000 });
    }

    // Phase 7 (Story 5.5) — at the deterministic mid-journey state (first
    // task verified, funding unassigned) the Blocker List names exactly
    // what still stands between this placement and Active. Everything
    // already satisfied — the confirmed schedule, Casey's completed
    // training, the match decisions — stays off the list. Guarded so a
    // retry that already progressed past this state skips the snapshot.
    if (await page.getByText(/7 required steps remain/).isVisible().catch(() => false)) {
      const blockers = page.getByRole("list", { name: "Activation blockers" });
      await expect(blockers).toBeVisible({ timeout: 20_000 });
      await expect(
        blockers.getByText("Open — Active funding assignment"),
      ).toBeVisible();
      await expect(
        blockers.getByText(
          "Open — Host-site safety orientation and assigned-task competency confirmed",
        ),
      ).toBeVisible();
      await expect(blockers.getByText(/Schedule confirmed/)).toHaveCount(0);
      await expect(blockers.getByText(/Portable training/)).toHaveCount(0);
      await expect(blockers.getByText(/Valid enrollment/)).toHaveCount(0);
      await expect(
        blockers.getByRole("link", { name: "Assign a funding source." }),
      ).toBeVisible();
      // The Activate control is disabled — not hidden — while blockers
      // remain, with the outstanding items named beside it (Story 5.6).
      await expect(
        page.getByRole("button", { name: "Activate Placement" }),
      ).toBeDisabled();
      await expect(page.getByText("Activation is waiting on:")).toBeVisible();
    }

    // Phase 8 (Story 5.6) — resolve every blocker, then activate. Drive
    // the progress count to zero; each click waits for the next
    // server-rendered count before proceeding.
    for (let remaining = 8; remaining > 0; remaining--) {
      const line = page.getByText(new RegExp(`${remaining} required steps? remain`));
      if (!(await line.isVisible().catch(() => false))) continue;
      await page.getByRole("button", { name: /^Mark Done:/ }).first().click();
      await expect(
        page.getByText(
          new RegExp(
            `${remaining - 1} required steps? remain|All required steps are complete`,
          ),
        ),
      ).toBeVisible({ timeout: 20_000 });
    }
    await expect(page.getByText("All required steps are complete.")).toBeVisible({
      timeout: 20_000,
    });

    await page.goto(`${WORKSPACE}?tab=funding`);
    const sourceSelect = page.getByLabel("Funding source");
    if (await sourceSelect.isVisible({ timeout: 20_000 }).catch(() => false)) {
      await sourceSelect.selectOption({ label: "E2E Grant Fund (Synthetic)" });
      await page.getByLabel("Effective start date").fill("2026-08-01");
      await page.getByRole("button", { name: "Assign Funding" }).click();
    }
    await expect(
      page.getByRole("list", { name: "Funding assignments" }).getByText("Active"),
    ).toBeVisible({ timeout: 20_000 });

    await page.goto(WORKSPACE);
    await expect(
      page.getByText("All activation prerequisites are met."),
    ).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole("checkbox", { name: /activate this placement/i })
      .check();
    await page.getByRole("button", { name: "Activate Placement" }).click();
  }

  // The placement is Active with its lifecycle trail complete (5.6 AC5).
  await expect(page.getByText(/· Stage: (Active|Paused)/)).toBeVisible({
    timeout: 20_000,
  });
  await page.goto(`${WORKSPACE}?tab=history`);
  await expect(page.getByText(/Onboarding → .*Active/).first()).toBeVisible({
    timeout: 20_000,
  });

  // Phase 9 (Story 5.7) — one pause/resume cycle: the pause carries a
  // required reason, Paused reads distinctly on the stage line and
  // timeline, and both transitions land in History with the reason
  // visible to the coordinator. A retry that finds the placement already
  // Active simply runs another cycle — history accumulates, never
  // overwrites (AC3), so the matchers take .first().
  await page.goto(WORKSPACE);
  const pauseOpen = page.getByRole("button", { name: "Pause Placement…" });
  if (await pauseOpen.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await pauseOpen.click();
    await page
      .getByLabel("Reason (required)")
      .selectOption({ label: "Medical leave" });
    await page
      .getByLabel("Details (optional, internal)")
      .fill("Synthetic pause for the E2E cycle");
    await page.getByRole("button", { name: "Yes, Pause Placement" }).click();
    await expect(page.getByText(/· Stage: Paused/)).toBeVisible({ timeout: 20_000 });
    await expect(
      page
        .getByRole("list", { name: "Placement lifecycle" })
        .getByText("Paused"),
    ).toBeVisible();
  }

  const resumeOpen = page.getByRole("button", { name: "Resume Placement…" });
  if (await resumeOpen.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await resumeOpen.click();
    await page.getByRole("button", { name: "Yes, Resume Placement" }).click();
  }
  await expect(page.getByText(/· Stage: Active/)).toBeVisible({ timeout: 20_000 });

  await page.goto(`${WORKSPACE}?tab=history`);
  await expect(page.getByText(/Active → .*Paused/).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Paused → .*Active/).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/Paused \(Medical leave\)/).first()).toBeVisible();
});
