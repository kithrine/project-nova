import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

import {
  E2E_OPS_USER_EMAIL,
  E2E_OTHER_MANAGER_USER_EMAIL,
  E2E_PARTICIPANT_USER_EMAIL,
  E2E_SHELTER_MANAGER_USER_EMAIL,
  E2E_USER_EMAIL,
} from "./test-user";
import { signIn } from "./sign-in";

/**
 * Matching queue (Story 4.1): the coordinator worklist surfaces the ready
 * fixture participant and shelter capacity, and pairing selection opens the
 * review route; shelter and participant identities are denied.
 *
 * SEQUENTIAL (mode "default", not "serial"): these tests share the
 * Quinn/Riley/Parker fixture rows, and two of them are minute-long
 * multi-sign-in journeys — fullyParallel ran them across workers, racing
 * shared state and stacking dev-server load. One worker in declaration
 * order removes both; unlike "serial", a failure still retries alone and
 * skips nothing (each journey is independently retry-idempotent). The 180s
 * budget gives the short tests room past the 30s default for a sign-in
 * backoff plus one stalled step gate; the long journeys override to 300s.
 */
test.describe.configure({ mode: "default", timeout: 180_000 });

// Step gate: match-route server actions intermittently stall — a recorded
// "Save Draft Details" POST completed in 50s (application-code) with the
// write persisted, while neighboring requests stayed fast. 90s clears the
// observed worst case with margin and costs nothing when green — the wait
// returns as soon as the state renders.
const STEP_TIMEOUT = 90_000;

test("a coordinator works the queue and opens a candidate pairing", async ({ page }) => {
  // One linear journey that grows with each story (4.1 -> 4.6): queue ->
  // review -> draft -> propose -> assisted decline -> re-propose -> shelter
  // approval. Five sign-ins plus cold route compiles under parallel local
  // load — give it real headroom past the 30s default.
  test.setTimeout(300_000);
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/placements");

  await expect(
    page.getByRole("heading", { level: 1, name: "Matching queue" }),
  ).toBeVisible({ timeout: STEP_TIMEOUT });

  // Retry safety: a previous attempt may have left Quinn mid-match. Clear
  // it through the product's own paths — withdraw a Draft, or record an
  // assisted decline on a Proposed match (Story 4.5).
  const leftover = page.getByRole("link", { name: "Open match: Quinn Synthetic-Match" });
  if (await leftover.isVisible().catch(() => false)) {
    await leftover.click();
    // Branch on the server-rendered status line AFTER the workspace
    // settles — a no-wait isVisible() probe here once mis-branched during
    // hydration and hung on a control that never renders for a Draft.
    const statusLine = page.getByText(/^Status: .*(Draft|Proposed)/);
    await expect(statusLine).toBeVisible({ timeout: STEP_TIMEOUT });
    if (await page.getByText(/^Status: .*Draft/).isVisible().catch(() => false)) {
      await page.getByLabel(/I no longer want to pursue this match/).check();
      await page.getByRole("button", { name: "Withdraw Draft" }).click();
    } else {
      await page.getByLabel("The participant declines this placement").check();
      await page.getByLabel(/I confirmed this decision with the participant/).check();
      await page.getByRole("button", { name: "Record Participant Decision" }).click();
      await expect(page.getByText(/^Status: .*Declined/)).toBeVisible({ timeout: STEP_TIMEOUT });
      await page.goto("/operations/placements");
    }
    await expect(
      page.getByRole("heading", { level: 1, name: "Matching queue" }),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
  }

  // The ready fixture participant appears as awaiting, with readiness
  // context and the blockers carried over from 3.6 (a required training
  // with no attempt on this fixture program).
  await expect(
    page
      .getByLabel("Participants awaiting match")
      .getByText("Quinn Synthetic-Match", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByLabel("Participants awaiting match")
      .locator("li", { hasText: "Quinn Synthetic-Match" })
      .getByText("Awaiting match"),
  ).toBeVisible();
  await expect(page.getByText(/Availability: Weekday mornings/)).toBeVisible();
  // Scoped to Quinn's row — the Riley fixture (4.6) shares this fixture
  // program, so the same blocker label renders on their row too.
  await expect(
    page
      .getByLabel("Participants awaiting match")
      .locator("li", { hasText: "Quinn Synthetic-Match" })
      .getByText(/Re-emerged blockers: Core Readiness Training \(Synthetic\)/),
  ).toBeVisible();

  // Shelter capacity is listed alongside.
  await expect(page.getByText("Main Site (Synthetic) — capacity 3")).toBeVisible();

  // Selecting the pair opens the review route for exactly that pairing.
  // Row-scoped: once Riley's 4.7 cycle ends in withdrawal, a second
  // awaiting row (with its own pairing form) can share this queue.
  await page
    .getByLabel("Participants awaiting match")
    .locator("li", { hasText: "Quinn Synthetic-Match" })
    .getByLabel("Candidate shelter site")
    .selectOption({ label: "E2E Test Shelter (Synthetic) — Main Site (Synthetic) (capacity 3)" });
  await page.getByRole("button", { name: "Review Pairing: Quinn Synthetic-Match" }).click();

  await expect(
    page.getByRole("heading", {
      name: /Quinn Synthetic-Match × E2E Test Shelter \(Synthetic\) — Main Site \(Synthetic\)/,
    }),
  ).toBeVisible({ timeout: STEP_TIMEOUT });

  // Story 4.2: the categorical, explainable read — Quinn's fixture program
  // requires a training with no attempt, so the pairing blocks and the
  // panel names exactly why. Text + icon, no score anywhere.
  await expect(
    page.getByRole("heading", { name: "Blocking incompatibility" }),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
  await expect(
    page.getByText("Training incomplete: 0 of 1 required programs complete."),
  ).toBeVisible();
  await expect(page.getByText(/On file: "Weekday mornings"/)).toBeVisible();
  await expect(
    page.getByText(/Not yet proposed — set on the match draft/).first(),
  ).toBeVisible();
  await expect(page.getByText(/the coordinator makes the decision/i)).toBeVisible();

  // Story 4.3: assemble a draft from the reviewed pairing.
  await page.getByRole("button", { name: "Create Match Draft" }).click();
  await expect(
    page.getByText(/^Status: .*Draft.*Coordinator-internal/),
  ).toBeVisible({ timeout: STEP_TIMEOUT });

  // Edit the arrangement — the snapshot re-evaluates on save.
  await page.getByLabel("Candidate schedule").fill("Mon/Wed mornings");
  await page.getByLabel("Candidate start date").fill("2026-08-03");
  await page.getByLabel("Candidate end date").fill("2026-12-04");
  await page.getByRole("button", { name: "Save Draft Details" }).click();
  await expect(page.getByText(/Draft saved — the compatibility read/)).toBeVisible({
    timeout: STEP_TIMEOUT,
  });
  await expect(page.getByText("Proposed: Mon/Wed mornings")).toBeVisible();

  // The queue now shows this participant as in progress, with the match in
  // the worklist — and a repeat pairing review is Blocked with the reason.
  await page.goto("/operations/placements");
  await expect(
    page
      .getByLabel("Participants awaiting match")
      .locator("li", { hasText: "Quinn Synthetic-Match" })
      .getByText("Match in progress"),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
  await expect(
    page.getByRole("link", { name: "Open match: Quinn Synthetic-Match" }),
  ).toBeVisible();

  // Story 4.4: complete the draft and propose it across the boundary.
  await page.getByRole("link", { name: "Open match: Quinn Synthetic-Match" }).click();
  await expect(page.getByLabel("Candidate supervisor")).toBeVisible({ timeout: STEP_TIMEOUT });
  // The propose control stays disabled until the core fields are complete.
  await expect(page.getByRole("button", { name: "Propose Match" })).toBeDisabled();
  // Clerk provisioning syncs displayName from the Clerk profile on sign-in,
  // so every fixture identity reads "Synthetic E2E" here.
  await page.getByLabel("Candidate supervisor").selectOption({ label: "Synthetic E2E" });
  await page.getByRole("button", { name: "Save Draft Details" }).click();
  await expect(page.getByText(/Draft saved — the compatibility read/)).toBeVisible({
    timeout: STEP_TIMEOUT,
  });

  await page.getByRole("button", { name: "Propose Match" }).click();
  await expect(page.getByText(/^Status: .*Proposed/)).toBeVisible({ timeout: STEP_TIMEOUT });
  await expect(page.getByText(/^Participant decision: .*Pending/)).toBeVisible();
  await expect(page.getByText(/^Shelter decision: .*Pending/)).toBeVisible();

  // The shelter side sees it under Placement approvals — their org only.
  await clerk.signOut({ page });
  await signIn(page, E2E_USER_EMAIL);
  await page.goto("/shelter");
  await expect(
    page.getByRole("heading", { name: "Placement approvals" }),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
  await expect(page.getByText("Quinn Synthetic-Match")).toBeVisible();
  await expect(page.getByText("Schedule: Mon/Wed mornings")).toBeVisible();
  await expect(page.getByText(/Supervisor: Synthetic E2E/).first()).toBeVisible();

  // Story 4.5 (AC3): Quinn communicated a decline by phone — the
  // coordinator records it on Quinn's behalf. The decline is a unilateral
  // veto: the match becomes Declined and Quinn returns to the queue.
  await clerk.signOut({ page });
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/placements");
  await page.getByRole("link", { name: "Open match: Quinn Synthetic-Match" }).click();
  await expect(page.getByText(/^Participant decision: .*Pending/)).toBeVisible({
    timeout: STEP_TIMEOUT,
  });
  await page.getByLabel("The participant declines this placement").check();
  await page
    .getByLabel(/Note \(optional — Operations-only/)
    .fill("Prefers afternoons — told us by phone");
  await page.getByLabel(/I confirmed this decision with the participant/).check();
  await page.getByRole("button", { name: "Record Participant Decision" }).click();
  await expect(page.getByText(/^Status: .*Declined/)).toBeVisible({ timeout: STEP_TIMEOUT });
  // The declined workspace keeps the decision trail: who, when, on whose
  // behalf, and the Operations-only note (4.5 AC6).
  await expect(
    page.getByText(/^Participant decision: .*Declined.*recorded by staff/),
  ).toBeVisible();
  await expect(
    page.getByText("Participant note: Prefers afternoons — told us by phone"),
  ).toBeVisible();

  // Quinn is awaiting match again — assemble and propose a fresh match,
  // leaving a live pending proposal for the 4.6 shelter-decision journey.
  await page.goto("/operations/placements");
  await expect(
    page
      .getByLabel("Participants awaiting match")
      .getByText("Quinn Synthetic-Match", { exact: true }),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
  // Row-scoped: once Riley's 4.7 cycle ends in withdrawal, a second
  // awaiting row (with its own pairing form) can share this queue.
  await page
    .getByLabel("Participants awaiting match")
    .locator("li", { hasText: "Quinn Synthetic-Match" })
    .getByLabel("Candidate shelter site")
    .selectOption({ label: "E2E Test Shelter (Synthetic) — Main Site (Synthetic) (capacity 3)" });
  await page.getByRole("button", { name: "Review Pairing: Quinn Synthetic-Match" }).click();
  await page.getByRole("button", { name: "Create Match Draft" }).click();
  await expect(page.getByText(/^Status: .*Draft/)).toBeVisible({ timeout: STEP_TIMEOUT });
  await page.getByLabel("Candidate schedule").fill("Mon/Wed mornings");
  await page.getByLabel("Candidate start date").fill("2026-08-03");
  await page.getByLabel("Candidate end date").fill("2026-12-04");
  await page.getByLabel("Candidate supervisor").selectOption({ label: "Synthetic E2E" });
  await page.getByRole("button", { name: "Save Draft Details" }).click();
  await expect(page.getByText(/Draft saved — the compatibility read/)).toBeVisible({
    timeout: STEP_TIMEOUT,
  });
  await page.getByRole("button", { name: "Propose Match" }).click();
  await expect(page.getByText(/^Status: .*Proposed/)).toBeVisible({ timeout: STEP_TIMEOUT });
  await expect(page.getByText(/^Participant decision: .*Pending/)).toBeVisible();

  // Story 4.6 (AC1): the Shelter MANAGER approves the fresh proposal from
  // the Placement approvals list. Approval keeps the match Proposed — it
  // satisfies one of the two prerequisites for the 4.8 gate.
  await clerk.signOut({ page });
  await signIn(page, E2E_SHELTER_MANAGER_USER_EMAIL);
  await page.goto("/shelter");
  const quinnRow = page.locator("li", { hasText: "Quinn Synthetic-Match" });
  await expect(quinnRow).toBeVisible({ timeout: STEP_TIMEOUT });
  await quinnRow.getByRole("button", { name: "Approve Placement" }).click();
  await expect(quinnRow.getByText("Approve this placement?")).toBeVisible();
  await quinnRow.getByRole("button", { name: "Yes, Approve" }).click();
  await expect(quinnRow.getByText(/Your decision: Approved/)).toBeVisible({
    timeout: STEP_TIMEOUT,
  });

  // The coordinator's workspace reflects the recorded shelter track.
  await clerk.signOut({ page });
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/placements");
  await page.getByRole("link", { name: "Open match: Quinn Synthetic-Match" }).click();
  await expect(page.getByText(/^Shelter decision: .*Approved/)).toBeVisible({
    timeout: STEP_TIMEOUT,
  });

  // Story 4.8: the human gate names what's outstanding — the participant
  // hasn't accepted yet — and stays disabled.
  await expect(
    page.getByText("Waiting on the participant's acceptance."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve Match" })).toBeDisabled();

  // Quinn accepted by phone; the coordinator records it (4.5 AC3).
  await page.getByLabel("The participant accepts this placement").check();
  await page.getByLabel(/I confirmed this decision with the participant/).check();
  await page.getByRole("button", { name: "Record Participant Decision" }).click();
  await expect(page.getByText(/^Participant decision: .*Accepted/)).toBeVisible({
    timeout: STEP_TIMEOUT,
  });

  // Both tracks favorable: the explicit, confirmed approval creates the
  // placement in the same transaction (AC1) and shows its reference (AC5).
  await expect(
    page.getByText(/The participant accepted and the shelter approved/),
  ).toBeVisible();
  await page
    .getByLabel(/this creates the placement and can't be undone/)
    .check();
  await page.getByRole("button", { name: "Approve Match" }).click();
  await expect(page.getByText(/^Status: .*Approved/)).toBeVisible({ timeout: STEP_TIMEOUT });
  await expect(page.getByText(/placement PLC-\d{4}-[A-Z2-9]{6} created/)).toBeVisible();
  await expect(page.getByText(/reviews the specific site, supervisor/)).toBeVisible();

  // The pipeline is occupied: Quinn is out of the queue entirely — no
  // awaiting row, no in-progress worklist link (4.1 AC3, live since 4.8).
  await page.goto("/operations/placements");
  await expect(
    page.getByRole("heading", { level: 1, name: "Matching queue" }),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
  await expect(
    page
      .getByLabel("Participants awaiting match")
      .locator("li", { hasText: "Quinn Synthetic-Match" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open match: Quinn Synthetic-Match" }),
  ).toHaveCount(0);
});

test("a change request is revised, re-proposed, then finally withdrawn (Stories 4.6 AC2 + 4.7)", async ({
  page,
}) => {
  // Four sign-in phases; each is guarded by its precondition so retries
  // converge on the terminal state instead of failing mid-cycle.
  test.setTimeout(300_000);

  // Phase 1 — the shelter manager requests changes with the required,
  // actionable note (4.6 AC2).
  await signIn(page, E2E_SHELTER_MANAGER_USER_EMAIL);
  await page.goto("/shelter");
  await expect(
    page.getByRole("heading", { name: "Placement approvals" }),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
  const rileyRow = page.locator("li", { hasText: "Riley Synthetic-Change" });
  if (await rileyRow.isVisible().catch(() => false)) {
    await rileyRow.getByRole("button", { name: "Request Changes" }).click();
    await rileyRow
      .getByLabel("Note for the coordinator (required)")
      .fill("Friday intake is full — weekend mornings work better for us");
    await rileyRow.getByRole("button", { name: "Yes, Request Changes" }).click();
    await expect(rileyRow).not.toBeVisible({ timeout: STEP_TIMEOUT });
  }

  // Phase 2 — the coordinator sees the note beside the prior terms,
  // revises the schedule, and re-proposes (4.7 AC1/AC2).
  await clerk.signOut({ page });
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/placements");
  // Settle on the server-rendered landmark before probing: isVisible()
  // ignores its timeout option (deprecated no-wait check), so an ungated
  // probe races hydration and can mis-branch — same guard as the first
  // journey's leftover check.
  await expect(
    page.getByRole("heading", { level: 1, name: "Matching queue" }),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
  const rileyMatchLink = page.getByRole("link", {
    name: "Open match: Riley Synthetic-Change",
  });
  if (await rileyMatchLink.isVisible().catch(() => false)) {
    await rileyMatchLink.click();
    const changePanel = page.getByText("The shelter requested changes");
    await expect(
      page.getByText(/^Status: .*(Proposed|Change requested)/),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
    if (await changePanel.isVisible().catch(() => false)) {
      await expect(
        page.getByText(/weekend mornings work better for us/),
      ).toBeVisible();
      // Retry convergence: the pristine fixture schedule ("Fri mornings")
      // only survives the first pass — a retry after an attempt that saved
      // the revision legitimately sees "Sat/Sun mornings". Both states are
      // asserted strictly; any third value is a real failure.
      await expect(page.getByLabel("Candidate schedule")).toHaveValue(
        /^(Fri mornings|Sat\/Sun mornings)$/,
      );
      await page.getByLabel("Candidate schedule").fill("Sat/Sun mornings");
      await page.getByRole("button", { name: "Save Revised Details" }).click();
      await expect(page.getByText(/Revision saved — the compatibility read/)).toBeVisible(
        { timeout: STEP_TIMEOUT },
      );
      await page.getByRole("button", { name: "Re-propose Match" }).click();
      await expect(page.getByText(/^Status: .*Proposed/)).toBeVisible({
        timeout: STEP_TIMEOUT,
      });
      // Fresh cycle: both tracks reset to Pending.
      await expect(page.getByText(/^Participant decision: .*Pending/)).toBeVisible();
      await expect(page.getByText(/^Shelter decision: .*Pending/)).toBeVisible();
    }
  }

  // Phase 3 — the revised proposal is back in the shelter's approvals;
  // this time the manager asks for another change.
  await clerk.signOut({ page });
  await signIn(page, E2E_SHELTER_MANAGER_USER_EMAIL);
  await page.goto("/shelter");
  // Landmark gate before the no-wait probe (see phase 2).
  await expect(
    page.getByRole("heading", { name: "Placement approvals" }),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
  if (await rileyRow.isVisible().catch(() => false)) {
    await expect(rileyRow.getByText("Schedule: Sat/Sun mornings")).toBeVisible();
    await rileyRow.getByRole("button", { name: "Request Changes" }).click();
    await rileyRow
      .getByLabel("Note for the coordinator (required)")
      .fill("Renovation starts in August — we need to pause this one");
    await rileyRow.getByRole("button", { name: "Yes, Request Changes" }).click();
    await expect(rileyRow).not.toBeVisible({ timeout: STEP_TIMEOUT });
  }

  // Phase 4 — the coordinator withdraws instead of revising (4.7 AC3).
  await clerk.signOut({ page });
  await signIn(page, E2E_OPS_USER_EMAIL);
  await page.goto("/operations/placements");
  // Landmark gate before the no-wait probe (see phase 2). A mis-branch
  // here skips the withdrawal and the unconditional queue assertion below
  // then fails.
  await expect(
    page.getByRole("heading", { level: 1, name: "Matching queue" }),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
  if (await rileyMatchLink.isVisible().catch(() => false)) {
    await rileyMatchLink.click();
    await expect(page.getByText("The shelter requested changes")).toBeVisible({
      timeout: STEP_TIMEOUT,
    });
    await page.getByLabel(/I no longer want to pursue this match/).check();
    await page.getByRole("button", { name: "Withdraw Match" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Matching queue" }),
    ).toBeVisible({ timeout: STEP_TIMEOUT });
  }

  // The participant reappears in the queue as awaiting match (4.7 AC3).
  await page.goto("/operations/placements");
  await expect(
    page
      .getByLabel("Participants awaiting match")
      .locator("li", { hasText: "Riley Synthetic-Change" })
      .getByText("Awaiting match"),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
});

test("a shelter supervisor can view proposals but not decide (Story 4.6, AC4)", async ({
  page,
}) => {
  await signIn(page, E2E_USER_EMAIL);
  await page.goto("/shelter");

  // Parker's fixture proposal is stable all run; the read-only state is
  // visible and NO decision action renders anywhere for a supervisor.
  const parkerRow = page.locator("li", { hasText: "Parker Synthetic-Participant" });
  await expect(parkerRow).toBeVisible({ timeout: STEP_TIMEOUT });
  await expect(
    parkerRow.getByText(/Read-only — your Shelter Manager records the decision/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve Placement" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Decline Placement" })).toHaveCount(0);
});

test("a different shelter's manager sees none of it (Story 4.6, AC5)", async ({
  page,
}) => {
  await signIn(page, E2E_OTHER_MANAGER_USER_EMAIL);
  await page.goto("/shelter");

  await expect(
    page.getByText(/No proposed placements are waiting on your review right now/),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
  await expect(page.getByText("Quinn Synthetic-Match")).toHaveCount(0);
  await expect(page.getByText("Parker Synthetic-Participant")).toHaveCount(0);
  await expect(page.getByText("Riley Synthetic-Change")).toHaveCount(0);
});

test("a participant accepts their proposed placement on their dashboard (Story 4.5, AC1)", async ({
  page,
}) => {
  await signIn(page, E2E_PARTICIPANT_USER_EMAIL);
  await page.goto("/participant");

  const proposedHeading = page.getByRole("heading", {
    name: "A placement has been proposed for you",
  });
  const acceptedHeading = page.getByRole("heading", {
    name: "You accepted this placement",
  });
  await expect(proposedHeading.or(acceptedHeading)).toBeVisible({ timeout: STEP_TIMEOUT });

  // Retry safety: acceptance is one-way, so a prior attempt may already
  // have recorded it — the accepted state is then the thing to verify.
  if (await proposedHeading.isVisible().catch(() => false)) {
    await expect(
      page.getByText(/E2E Test Shelter \(Synthetic\) — Main Site \(Synthetic\)/),
    ).toBeVisible();
    await expect(page.getByText("Tue/Thu afternoons")).toBeVisible();

    // Both choices are offered; accepting goes through a confirmation.
    await expect(
      page.getByRole("button", { name: "Decline This Placement" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Accept This Placement" }).click();
    await expect(
      page.getByText(/You're accepting this placement at E2E Test Shelter/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Yes, Accept This Placement" }).click();
  }

  await expect(acceptedHeading).toBeVisible({ timeout: STEP_TIMEOUT });
  await expect(
    page.getByText(/nothing more is needed from you right now/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept This Placement" }),
  ).not.toBeVisible();
});

test("a shelter manager is denied the queue (AC6)", async ({ page }) => {
  await signIn(page, E2E_USER_EMAIL);
  await page.goto("/operations/placements");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
});

test("a participant is denied the queue (AC6)", async ({ page }) => {
  await signIn(page, E2E_PARTICIPANT_USER_EMAIL);
  await page.goto("/operations/placements");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible({ timeout: STEP_TIMEOUT });
});
