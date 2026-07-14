# Epic 6 — Work Hours

## Goal
Record and approve participant work hours.

## Stories

| ID | Story | Status |
|---|---|---|
| 6.1 | Create weekly timesheet | Done |
| 6.2 | Add work entries | Done |
| 6.3 | Calculate hours server-side | Done |
| 6.4 | Submit timesheet | Done |
| 6.5 | Shelter approval | Done |
| 6.6 | Reject for correction | Ready for Development |
| 6.7 | Lock approved timesheet | Ready for Development |

> Sequencing note: the epic is numbered 6.1–6.7 for reference, but 6.2 and 6.3 are tightly coupled — the work-entry form in 6.2 depends on 6.3's server-side calculation service to produce the hours it displays and stores, so build 6.3 alongside or before 6.2. Stories 6.5 and 6.6 share the same Submitted-timesheet review surface (the Timesheet Review Card and the shelter Timesheets queue, both built in 6.5), so they are naturally implemented together even though they are specified separately for their distinct outcomes.

---

## Story 6.1 — Create weekly timesheet

### Status
Done

> Built note: Timesheet + TimesheetEvent landed together (the full
> status enum with 6.1, the append-only event trail from creation — the
> house aggregate pattern) with the (placementId, weekStartDate) unique
> constraint as the idempotency backstop; the double-open race resolves
> by catching P2002 and refetching the winner. All week math is UTC
> Monday arithmetic in domain code (mondayOfWeek/parseWeekParam — a
> non-Monday or malformed ?week= falls back to the current week rather
> than trusting client input). timesheet.create is the participant
> tier's first role-granted write, still ownership-resolved through the
> Person → Participant chain on every call: the service accepts no
> placement or participant id (AC6 by construction). Existing weeks
> stay readable after the placement leaves ACTIVE; only NEW creation is
> gated. totalHours renders via Decimal.toFixed(2) — string-shaped end
> to end. E2E rides a new second Clerk participant (Harper,
> e2e_placement_hours, ACTIVE) so Parker's ONBOARDING fixture — which
> five other specs depend on — stays untouched.

### User story
As a participant with an active placement, I want this week's timesheet ready when I go to record my hours, so that I don't have to set anything up myself before I can log my time.

### Scope
- Define the `Timesheet` model and its status lifecycle: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `LOCKED`. This story introduces the full enum; later stories in this epic drive the transitions past `DRAFT`, consistent with the transition rules in `docs/product/business-rules.md`.
- Get-or-create a `Timesheet` for the participant's own `Placement` and a given week, the first time they open My Hours (`docs/ux/information-architecture.md`) for that week — idempotent, at most one `Timesheet` per `Placement` per week.
- Default to the current week (Monday–Sunday, a fixed MVP convention) and allow navigating to and creating a timesheet for a prior week within the placement's active period; a future week cannot be created.
- Restrict creation to placements in the `ACTIVE` lifecycle state (`docs/product/placement-lifecycle.md`) — no timesheet can be started for a placement that is `Onboarding`, `Paused`, or terminal.
- New timesheets are created directly in `DRAFT` status with `totalHours` of `0.00`.
- Build on the `(participant)` protected layout (1.7) and the My Hours navigation entry.

### Acceptance criteria
1. Given a participant with an `ACTIVE` placement and no `Timesheet` yet for the current week, when they open My Hours, then a new `Timesheet` is created in `DRAFT` status for that placement and week, with `totalHours` of `0.00`.
2. Given a participant who already has a `Timesheet` for the current week, when they open My Hours again, then the existing record is reused and no duplicate `Timesheet` is created for the same placement and week.
3. Given a participant navigates to a prior week within their placement's active period with no existing `Timesheet`, when they choose to record hours for that week, then a new `DRAFT` `Timesheet` is created for that week.
4. Given a participant attempts to open or create a timesheet for a future week, when requested, then creation is blocked.
5. Given a placement that is not `ACTIVE` (for example, `ONBOARDING` or `PAUSED`), when a participant attempts to start a new timesheet against it, then creation is denied, while any timesheet already created before the status change is unaffected.
6. Given a client-supplied placement ID or participant ID, when the create-or-get operation runs, then it is resolved and scoped server-side to the authenticated participant's own placement only — never trusting a client-supplied ID.

### Authorization
`timesheet.create`, granted to the Participant role, resource-scoped to the participant's own `Placement` (via the `Membership`-backed Participant identity established at acceptance, Epic 3 Story 3.1). Business-prerequisite gate: the `Placement` must be `ACTIVE` at the moment of creation.

### Lifecycle rules
`Timesheet` is created directly into `DRAFT`, the entry point of its own action-based lifecycle (`DRAFT` → `SUBMITTED` → `APPROVED` or `REJECTED` → `LOCKED`). This story performs only the initial creation; no other transition happens here.

### Data changes
Creates `Timesheet` (`id`, `placementId`, `weekStartDate`, `weekEndDate`, `status` [`DRAFT`/`SUBMITTED`/`APPROVED`/`REJECTED`/`LOCKED`], `totalHours` [`Decimal`], `submittedAt`/`approvedAt`/`rejectedAt`/`lockedAt` [null until reached], `createdAt`, `updatedAt`). A unique constraint on (`placementId`, `weekStartDate`) prevents duplicate timesheets for the same week.

### UX and accessibility
Weekly Hours Card component (`docs/ux/component-guidelines.md`) as the primary surface, reached from My Hours; mobile-first single-column layout — participants most often log hours from a phone — with the week's status stated in text, never color alone; Loading/Empty/Error states while the week resolves; keyboard-operable previous/next week navigation.

### Tests
- Unit: get-or-create idempotency logic; the `ACTIVE`-placement prerequisite check; future-week rejection.
- Integration: the unique constraint on (`placementId`, `weekStartDate`); ownership scoping resolves only the authenticated participant's own placement.
- Component: My Hours renders the current week's card in the correct state (new/empty vs. existing).
- E2E: a participant with an active placement opens My Hours for the first time and lands on a ready, empty `DRAFT` timesheet for the current week.

### Out of scope
Adding or editing entries (6.2), submitting (6.4), and any timesheet for a placement that has never been `ACTIVE`.

### Dependencies
Epic 5 (Active Placement — an `ACTIVE` placement with a schedule must exist; `docs/stories/epic-5-active-placement.md`), 1.5 (authorization context), 1.7 (participant protected layout).

---

## Story 6.2 — Add work entries

### Status
Done

> Built note: WorkEntry is a pure child of the Timesheet aggregate; the
> write contract carries NO hours field, so a spoofed value has nowhere
> to enter — proven by an integration test passing extraneous
> hours/totalHours through a cast and asserting the stored values are
> the 6.3-computed ones (that test also satisfies 6.3's integration
> AC). Every mutation revalidates ownership (Person → Participant) and
> the DRAFT/REJECTED window server-side; inside the transaction a
> status-guarded no-op update turns an entry save racing a submission
> into a clean conflict. Totals always recompute from the CURRENT full
> entry set — never incremental. Removal is a hard delete of
> pre-submission working data (the auditable record is the submitted
> week; post-submission entries are immutable through every path) —
> the story's "archives" wording resolved in favor of the simpler
> honest model, documented here. E2E self-heals on retry by clearing
> leftover entries before the deterministic add→invalid→correct→edit→
> remove cycle.

### User story
As a participant, I want to add my worked hours for each day of the week to my timesheet, so that my shelter supervisor has an accurate record to review.

### Scope
- Add, edit, and remove `Work Entry` records on a `Timesheet` that is `DRAFT` or `REJECTED` — the only two participant-editable states (`docs/product/business-rules.md`: "Participants may edit draft or rejected timesheets").
- Each entry captures a work date (within the timesheet's week), a start time, an end time, an optional unpaid break duration, and an optional short note describing the work performed. More than one entry per day is allowed (for example, a split shift).
- Use the Date/Time Input component (`docs/ux/component-guidelines.md`) with full keyboard operability — never a drag-and-drop-only picker (`docs/ux/accessibility.md`).
- Every save recalculates that entry's hours and the timesheet's total through the server-side calculation service (6.3); the client never supplies or edits an hours value directly.

### Acceptance criteria
1. Given a `DRAFT` or `REJECTED` timesheet, when the participant adds a work entry with a valid date, start time, and end time, then the entry is saved against that timesheet and the timesheet's total hours reflect it.
2. Given a timesheet that is `SUBMITTED`, `APPROVED`, or `LOCKED`, when the participant attempts to add, edit, or remove an entry, then the action is denied server-side, regardless of the UI state.
3. Given a work date outside the timesheet's `weekStartDate`–`weekEndDate` range, when an entry is saved, then it is rejected with a specific, actionable error.
4. Given an end time at or before the start time, when an entry is saved, then it is rejected with a specific error rather than producing a negative or zero duration.
5. Given a break duration that would exceed the shift's total duration, when an entry is saved, then it is rejected with a specific error.
6. Given an entry is edited or removed, when the change is saved, then the timesheet's total hours are recalculated from the current full set of entries, never adjusted incrementally or trusted from the client.

### Authorization
`timesheet.edit`, granted to the Participant role, resource-scoped to the participant's own `Timesheet` (via its `Placement`). Lifecycle gate: the `Timesheet` must be `DRAFT` or `REJECTED`, enforced server-side on every mutation, not only in the UI.

### Lifecycle rules
Performs no `Timesheet` status transition. Enforces the participant-editable window defined by `docs/product/business-rules.md`.

### Data changes
Creates/updates/archives `Work Entry` (`id`, `timesheetId`, `workDate`, `startTime`, `endTime`, `breakMinutes`, `hours` [`Decimal`, server-computed via 6.3], `note` [optional], `createdAt`, `updatedAt`) as child records of the `Timesheet` aggregate — Work Entry is not its own aggregate boundary (`docs/architecture/domain-model.md`). Updates `Timesheet.totalHours`.

### UX and accessibility
Weekly Hours Card with a per-day entry list and a visible running weekly total; labels above inputs, programmatic error association for date/time validation failures, mobile-first layout with large touch targets for time entry, Loading/Error/Success/Concurrent update states (relevant if the same timesheet is open in two tabs or devices), respectful microcopy per `docs/ux/content-style-guide.md`.

### Tests
- Unit: date-within-week validation; start/end/break validation rules; the `DRAFT`/`REJECTED` lifecycle guard.
- Integration: entry CRUD scoped to the owning timesheet/participant; server-side rejection of edits on non-editable statuses even via a direct call; concurrent-edit handling.
- Component: entry form validation states, running total display, accessible error messages.
- E2E: a participant adds several days of entries across a week and sees the running total update.

### Out of scope
The calculation algorithm itself (6.3), submission (6.4), any entry mutation on a `SUBMITTED`/`APPROVED`/`LOCKED` timesheet (no such capability exists in this epic).

### Dependencies
6.1 (a `DRAFT`/`REJECTED` `Timesheet` must exist), 6.3 (the calculation service each entry save relies on — see the epic Sequencing note).

---

## Story 6.3 — Calculate hours server-side

### Status
Done — built before 6.2 per the epic sequencing note

> Built note: pure integer arithmetic end to end — times become minutes
> since midnight, hours become hundredths of an hour, and the single
> rounding moment (net minutes × 100 ÷ 60, round half-up) is documented
> in code as the MVP convention; 7h45m = "7.75" exactly, and repeated
> runs are bit-identical (proven 1000×). Totals sum the STORED per-entry
> strings exactly, so the timesheet total always equals the sum of what
> each entry displays — no re-derivation that could disagree. Midnight
> crossing presents as end ≤ start on one calendar date and is invalid;
> a break consuming the whole shift is invalid rather than a 0.00 entry.
> The mutation wiring (entry saves calling this path, spoofed-hours
> rejection) lands with 6.2, whose input shape carries no hours field at
> all — the strongest form of "ignored".

### User story
As a Nova engineer, I want work-entry and timesheet hours calculated and stored authoritatively on the server, so that approved hours are always accurate, tamper-proof, and safe to rely on for funding and reporting.

### Scope
- Implement `TimesheetService` (`docs/architecture/api-service-design.md`) calculation functions: one that computes a single `Work Entry`'s `hours` from its start time, end time, and break minutes, and one that sums a `Timesheet`'s current entries into `totalHours`.
- Use exact `Decimal` arithmetic throughout (minutes converted to a decimal-hours value, for example 7 hours 45 minutes = `7.75`) — never floating-point types, per `RULES.md`.
- Recalculate on every entry mutation (6.2) and re-verify at submission time (6.4); the server always recomputes from the current entries and never persists or trusts a client-supplied `hours` or `totalHours` value.
- Same-day shifts only in MVP: a shift that would cross midnight is treated as invalid rather than silently miscalculated.

### Acceptance criteria
1. Given a work entry with a start time, end time, and break minutes, when hours are calculated, then the result equals `(end time − start time) − break minutes`, expressed as a `Decimal` value.
2. Given a set of work entries on a timesheet, when the timesheet total is calculated, then it equals the exact `Decimal` sum of each entry's `hours` — never a client-supplied total.
3. Given a request that includes an `hours` or `totalHours` value directly, when the server processes it, then the supplied value is ignored and recalculated from the authoritative start/end/break fields instead.
4. Given a work entry whose end time is on or before its start time on the same calendar day, when calculated, then it is treated as invalid rather than producing a negative value.
5. Given repeated calculation of the same entries, when run multiple times, then the result is identical every time (deterministic), with no floating-point rounding drift.
6. Given the calculation functions, when exercised in isolation, then they are covered by unit tests as a named business-rule target (`docs/architecture/testing-strategy.md`: "Work-hour calculations").

### Authorization
None beyond what 6.2/6.4 already enforce — this is internal calculation logic invoked by already-authorized mutations, not a separately reachable endpoint.

### Lifecycle rules
None. This story does not transition `Timesheet.status`; it guarantees the integrity of `hours`/`totalHours` at every point that depends on them.

### Data changes
No new persisted fields. Establishes the authoritative calculation path for `WorkEntry.hours` and `Timesheet.totalHours` (introduced in 6.1/6.2); both fields are always written by `TimesheetService`, never accepted verbatim from a client payload.

### UX and accessibility
No dedicated screen. A calculation-validity error (for example, an invalid same-day shift) surfaces through 6.2's entry form as a specific, accessible inline error rather than a generic failure message.

### Tests
- Unit: entry-hours calculation across representative start/end/break combinations, including edge cases (zero-length break, break equal to shift length, midnight-crossing rejection); timesheet-total summation; `Decimal`-precision determinism.
- Integration: a mutation that includes a spoofed `hours`/`totalHours` value is ignored and recalculated server-side; recalculation on entry edit/removal.
- Component: not applicable (no dedicated UI).
- E2E: covered indirectly through 6.2 and 6.4 — the displayed and submitted totals always match server-calculated values.

### Out of scope
Overtime rules, rounding conventions beyond exact decimal-hours conversion, and any wage or pay-rate calculation — payroll and tax workflows are deferred and out of scope for MVP (`docs/product/mvp.md`; `docs/product/prd.md`, "Non-goals for MVP"; `docs/planning/assumptions.md`, "Payroll and tax workflows" under Needs validation). Cross-midnight shift support.

### Dependencies
6.1 (`Timesheet.totalHours`), 6.2 (`WorkEntry` fields to calculate from) — tightly coupled; see the epic Sequencing note.

---

## Story 6.4 — Submit timesheet

### Status
Done

> Built note: one submit action serves both DRAFT and REJECTED
> (resubmission is the same mechanism, per the story), with the
> at-least-one-entry rule checked INSIDE the transaction alongside a
> fresh 6.3 total recalculation — an integration test tampers with the
> stored totalHours pre-submit and proves submission recomputes 7.75,
> never trusting the last-saved value. The compare-and-set turns a
> replayed submit or a racing tab into a clean lifecycle/conflict
> error; the event trail preserves every cycle
> (DRAFT→SUBMITTED→REJECTED→SUBMITTED proven in order); the audit
> detail carries only the hour total. The Submit control is disabled
> WITH its reason until an entry exists, then confirms with
> plain-language consequence copy; the post-submission statusNote
> ("Your hours were submitted for review…") is the on-screen
> what-happens-next, role=status for assistive tech. Visibility in the
> shelter's review queue is 6.5's surface — this story ends at the
> frozen, submitted week. E2E submits the PRIOR week so within-run
> retries keep the current week editable; submission being one-way
> makes the phase converge.

### User story
As a participant, I want to submit my completed timesheet, so that my shelter supervisor can review and approve my hours.

### Scope
- Explicit Submit action (Server Action), enabled from `DRAFT` or `REJECTED` status — the latter covering resubmission after a correction (6.6).
- Require at least one work entry before submission is allowed; recalculate and verify `totalHours` server-side at the moment of submission (6.3), never trusting the last-saved value.
- Transition to `SUBMITTED`, stamp `submittedAt`, and freeze participant editing until the timesheet is either rejected back to them (6.6) or approved (6.5).
- Plain-language, on-screen confirmation of what happens next, per `docs/ux/content-style-guide.md`; no email/messaging notification (messaging is deferred, `docs/decisions/ADR-012-messaging-v2.md`).

### Acceptance criteria
1. Given a `DRAFT` timesheet with at least one work entry, when the participant submits it, then it transitions to `SUBMITTED`, `submittedAt` is recorded, and it becomes visible in the shelter's Timesheets queue (6.5/6.6).
2. Given a `DRAFT` timesheet with no work entries, when submission is attempted, then it is blocked with a specific message explaining that at least one entry is required.
3. Given a `REJECTED` timesheet the participant has corrected, when they resubmit it, then it transitions to `SUBMITTED` again, a new `submittedAt` is recorded, and the prior rejection reason (6.6) remains visible in history rather than being discarded.
4. Given a timesheet that is not `DRAFT` or `REJECTED` (already `SUBMITTED`, `APPROVED`, or `LOCKED`), when a submit action is attempted again — for example, a stale tab or a replayed request — then it is rejected as a lifecycle error and no duplicate submission occurs.
5. Given the submit action executes, when it completes, then the status change, the server-recalculated `totalHours`, and the lifecycle/audit event are written in a single transaction.
6. Given a concurrent edit (two open tabs), when one tab submits and the other later attempts a stale entry save, then the stale write is rejected with the Concurrent update state, never silently overwritten.

### Authorization
`timesheet.submit`, granted to the Participant role, resource-scoped to the participant's own `Timesheet`. Lifecycle gate: `DRAFT` or `REJECTED` only.

### Lifecycle rules
`DRAFT` → `SUBMITTED` and `REJECTED` → `SUBMITTED` are the only transitions this story performs — the second is a resubmission, reusing the same action rather than a separate mechanism. Once `SUBMITTED`, the participant cannot edit until a shelter reviewer acts (6.5/6.6).

### Data changes
Updates `Timesheet.status`, `submittedAt`, and the server-verified `totalHours` in a single transaction; writes the associated lifecycle/audit event.

### UX and accessibility
The Submit control shows a Disabled state (with the reason) until at least one entry exists, a confirmation step before this largely committing action, mobile-first sticky primary action, the success confirmation announced to assistive technology, respectful confirmation copy ("Your hours were submitted for review").

### Tests
- Unit: the `DRAFT`/`REJECTED`-only lifecycle guard; the at-least-one-entry rule.
- Integration: transactional status transition with server-recalculated `totalHours` and its audit event; concurrency/staleness handling; resubmission preserves prior rejection history.
- Component: the Submit control's disabled/enabled states and success confirmation.
- E2E: "Participant submits hours" (`docs/architecture/testing-strategy.md`) — a participant adds entries, submits, and the timesheet appears in the shelter's review queue.

### Out of scope
The review/approval decision itself (6.5, 6.6), notification delivery.

### Dependencies
6.2 and 6.3 (entries and their calculated hours must exist), 1.5.

---

## Story 6.5 — Shelter approval

### Status
Done

> Built note: the canonical A = P + S + L check lives as a PURE domain
> function (reviewDenialReason) deciding four facts the service
> assembles — permission, host-org reach, standing (assigned supervisor
> | Shelter Manager | Nova staff), SUBMITTED — with each part
> unit-denied independently; approval and rejection (6.6) share it via
> a permission parameter. Surfaces: the shelter Timesheets queue
> (oldest submission first), the read-only Timesheet Review Card at
> /shelter/timesheets/[id] with an operations twin at
> /operations/timesheets/[id] (Nova reaches it from the workspace Hours
> tab — Operations has no queue in the IA), the Hours tab's week list,
> and the dashboard's awaiting-review count. Approve is explicit and
> confirmed, never inferred from viewing; the CAS resolves the
> concurrent-reviewer race to exactly one outcome (proven with
> Promise.allSettled), approver identity + hours-only audit detail
> recorded. The unassigned-supervisor denial (permission + org, no
> standing) is E2E'd implicitly via integration and covered in the
> canonical unit battery.

### User story
As a Shelter Supervisor, I want to review and approve a participant's submitted timesheet, so that their hours are confirmed accurate and ready to count toward their placement and funding.

### Scope
- Build the shelter Timesheets queue (`docs/ux/information-architecture.md`), surfacing `SUBMITTED` timesheets first, consistent with the Shelter dashboard's "Timesheets awaiting review" pattern (`docs/ux/wireframes-layouts.md`), and the Timesheet Review Card detail view (`docs/ux/wireframe-spec.md`, `docs/ux/component-guidelines.md`); also reachable from the Placement workspace's Hours tab (`docs/ux/wireframes-layouts.md`).
- Display the week's entries and total clearly enough to review before approving — read-only at this stage, since only the participant can edit entries (6.2).
- Approve action for a `Timesheet` in `SUBMITTED` status. This is the canonical worked example of `Authorization = Permission + Resource Scope + Lifecycle State` (`docs/architecture/authorization-rbac.md`): the approver must hold `timesheet.approve`, the placement must belong to their organization, they must be the assigned supervisor or an authorized manager, and the timesheet must be `SUBMITTED`.
- Also usable by authorized Nova staff standing in for a shelter (`docs/product/business-rules.md`: "Shelter or authorized Nova staff approve").

### Acceptance criteria
1. Given a `SUBMITTED` timesheet for a placement at their organization, when the assigned Shelter Supervisor approves it, then the timesheet transitions to `APPROVED`, `approvedAt` and the approver are recorded, and the participant sees it as approved.
2. Given a `SUBMITTED` timesheet, when a Shelter Supervisor who is neither the assigned supervisor nor a Shelter Manager at that organization attempts to approve it, then the action is denied, even though they generally hold `timesheet.approve`.
3. Given a `SUBMITTED` timesheet at a different organization than the approver's, when they attempt to approve it, then it is denied regardless of role or permission (organization-scope check).
4. Given an authorized Nova staff member (for example, a Program Coordinator) with `timesheet.approve`, when they approve a timesheet on a shelter's behalf, then it succeeds, and the approver's identity and organization membership (Nova, not the shelter) are recorded via `approvedByUserId` and the audit event.
5. Given a timesheet that is not `SUBMITTED` (`DRAFT`, `REJECTED`, `APPROVED`, or `LOCKED`), when an approve action is attempted, then it is rejected as a lifecycle error.
6. Given two authorized reviewers act on the same `SUBMITTED` timesheet at nearly the same time (one approves, one rejects), when both requests are processed, then only the first to complete succeeds and the second receives the Concurrent update state rather than silently overriding it.

### Authorization
`timesheet.view` for the queue and review detail (organization-scoped for shelter roles, Nova-scoped for Program Coordinator/Nova Administrator). `timesheet.approve` for the action itself — the canonical example in `docs/architecture/authorization-rbac.md` — requiring all of: (1) the approver holds `timesheet.approve`; (2) the timesheet's placement belongs to their active organization membership; (3) they are the placement's assigned Shelter Supervisor, a Shelter Manager at that organization, or authorized Nova staff standing in; (4) the timesheet is `SUBMITTED`.

### Lifecycle rules
`SUBMITTED` → `APPROVED` only. Approval is a distinct, explicit action — never inferred from merely viewing the timesheet.

### Data changes
Updates `Timesheet.status`, `approvedAt`, `approvedByUserId` in a single transaction; writes the lifecycle/audit event. No entry data changes at approval — approval confirms the participant's server-calculated hours as-is.

### UX and accessibility
Timesheet Review Card with a clear, unambiguous Approve action and a lightweight confirmation step, text-and-icon status (never color alone), and the Shelter dashboard's "Timesheets awaiting review" list reflecting the queue shrinking as items are approved; mobile-first, with the Operations/Shelter desktop view supporting denser review of multiple timesheets per `docs/ux/ux-spec.md`.

### Tests
- Unit: the four-part authorization check (permission, organization scope, supervisor-or-manager-or-Nova-staff, `SUBMITTED` lifecycle state) as the canonical A = P + S + L example.
- Integration: cross-organization approval is denied; approval by a non-assigned supervisor without manager standing is denied; a concurrent approve/reject race resolves to exactly one outcome.
- Component: the queue list, the Review Card's Approve action and confirmation step, queue-count updates.
- E2E: "Shelter approves hours" and "Cross-shelter access is denied" (`docs/architecture/testing-strategy.md`) — a supervisor approves a submitted timesheet and the participant sees the approved status; a supervisor at a different shelter cannot approve it.

### Out of scope
Rejecting (6.6), locking (6.7), any edit to entries at approval time.

### Dependencies
6.4 (a `SUBMITTED` timesheet must exist), the placement's assigned supervisor from Epic 5 (`docs/stories/epic-5-active-placement.md`), the Placement workspace shell (Epic 5, Story 5.1), 1.5.

---

## Story 6.6 — Reject for correction

### Status
Ready for Development

### User story
As a Shelter Supervisor, I want to send a submitted timesheet back to the participant with a clear reason, so that they can fix a mistake before I approve their hours.

### Scope
- Reject action for a `Timesheet` in `SUBMITTED` status, from the same Timesheet Review Card and review surface built in 6.5, with a required rationale explaining what needs correction.
- Held by the same set of reviewers as approval (assigned Shelter Supervisor, Shelter Manager at that organization, or authorized Nova staff), under the same organization-scope and lifecycle rules.
- Transition to `REJECTED`, re-opening the timesheet for participant edits (6.2) and resubmission (6.4) — the other of the two outcomes a `SUBMITTED` timesheet can reach.
- Participant-facing rejection copy is specific and respectful, per `docs/ux/content-style-guide.md` (for example, "Your supervisor asked for a correction on your hours for the week of [date]: [reason]" rather than a bare "Rejected").

### Acceptance criteria
1. Given a `SUBMITTED` timesheet for a placement at their organization, when the assigned Shelter Supervisor rejects it with a rationale, then the timesheet transitions to `REJECTED`, `rejectedAt` and the rejecting reviewer are recorded, and the rationale is stored.
2. Given a rejection is attempted with no rationale, when submitted, then it is blocked with a field-level validation error — a reason is always required.
3. Given a `REJECTED` timesheet, when the participant views it, then they see the specific rejection reason in plain, respectful language and can resume editing entries (6.2).
4. Given the same authorization rule as approval, when a reviewer without the required standing (wrong organization, or a supervisor who is neither assigned nor a manager) attempts to reject, then it is denied.
5. Given a timesheet that is not `SUBMITTED`, when a reject action is attempted, then it is rejected as a lifecycle error.
6. Given a rejection completes, when recorded, then it is written as a distinct lifecycle/audit event that remains visible in the timesheet's history even after a later resubmission and approval.

### Authorization
`timesheet.reject`, held by the same set as `timesheet.approve` (assigned Shelter Supervisor, Shelter Manager at the placement's organization, or authorized Nova staff), same organization-scope rule, lifecycle-gated to `SUBMITTED`.

### Lifecycle rules
`SUBMITTED` → `REJECTED` only. `REJECTED` re-enters the participant-editable window (`docs/product/business-rules.md`) and can only leave `REJECTED` through resubmission (6.4) — there is no separate discard or silent reset.

### Data changes
Updates `Timesheet.status`, `rejectedAt`, `rejectedByUserId`, `rejectionReason` (required text) in a single transaction; writes the lifecycle/audit event. Prior entry data is preserved unchanged for the participant to edit, not cleared.

### UX and accessibility
Timesheet Review Card's Reject action opens an accessible required-reason field (label above input, programmatic error association), and the participant's My Hours view surfaces the reason prominently using text and icon, never color alone, consistent with the Blocker List pattern used elsewhere (`docs/ux/component-guidelines.md`).

### Tests
- Unit: the required-rationale validation; the `SUBMITTED`-only lifecycle guard; the shared authorization check reused from 6.5.
- Integration: rejection transition and its audit event; rejection reason persists and remains visible through a later resubmission/approval cycle.
- Component: the reject-reason form and its accessible validation; the participant-facing rejection message.
- E2E: a supervisor rejects a submitted timesheet with a reason, the participant sees and corrects it, and resubmits successfully.

### Out of scope
Approving (6.5), locking (6.7), limiting the number of reject/resubmit cycles (unbounded in MVP).

### Dependencies
6.4 (a `SUBMITTED` timesheet must exist); shares its authorization rule and review surface with 6.5.

---

## Story 6.7 — Lock approved timesheet

### Status
Ready for Development

### User story
As a Program Coordinator, I want to lock an approved timesheet once it is finalized, so that its hours are permanently protected from change and safe to rely on for funding and reporting.

### Scope
- Explicit Lock action (Server Action) for a `Timesheet` in `APPROVED` status, performed by Nova Operations rather than the shelter, as the finalization step before hours are relied on downstream.
- Transition to `LOCKED`, the terminal state of the timesheet lifecycle — no further transition exists in this epic.
- Enforce that `LOCKED` (and, in practice, `APPROVED`) timesheets have no silent-edit path anywhere in the system, per `docs/product/business-rules.md`: "Approved records cannot be silently changed. Locked records require adjustment workflow."
- Locked hours are what a future Epic 7 report ("Approved hours by funding source," `docs/stories/epic-7-reporting-hardening.md`) can roll up by the placement's funding source (`docs/decisions/ADR-010-funding.md`) — this story only establishes the finalized, immutable record via the existing `placementId` link; the rollup/report itself is Epic 7's concern and stays out of scope here.

### Acceptance criteria
1. Given an `APPROVED` timesheet, when an authorized Nova staff member locks it, then it transitions to `LOCKED`, and `lockedAt` and the locking user are recorded.
2. Given a timesheet that is not `APPROVED` (`DRAFT`, `SUBMITTED`, `REJECTED`, or already `LOCKED`), when a lock action is attempted, then it is rejected as a lifecycle error.
3. Given a `LOCKED` timesheet, when any actor (including the participant, the approving supervisor, or an unauthorized Nova user) attempts to change its status or entries through any endpoint, then the change is denied server-side — there is no silent-edit path.
4. Given a user without `timesheet.lock` (for example, a Shelter Supervisor or Shelter Manager), when they attempt to lock a timesheet, then it is denied — locking is Nova-only in MVP.
5. Given a lock action completes, when recorded, then it is written to an audit event distinct from the approval event, marking the point at which the record becomes final for funding and reporting purposes.
6. Given a correction is needed on a `LOCKED` timesheet, when identified, then no capability in this epic performs it — a correction requires a separate adjustment workflow that is out of scope here (see Out of scope).

### Authorization
`timesheet.lock`, granted to Program Coordinator and Grant Administrator (and Nova Administrator) — Nova roles with operational or funding oversight — Nova organization scope. Not granted to shelter roles or to participants. Lifecycle gate: `APPROVED` only.

### Lifecycle rules
`APPROVED` → `LOCKED` is the final transition in the timesheet lifecycle for this epic. `LOCKED` is terminal — no story in this canonical set reopens it.

### Data changes
Updates `Timesheet.status`, `lockedAt`, `lockedByUserId` in a single transaction; writes the lifecycle/audit event.

### UX and accessibility
Lock action surfaced in the Placement workspace's Hours tab alongside approved timesheets, with a Confirmation Panel (`docs/ux/component-guidelines.md`) explaining that locking is final within this workflow, text-and-icon status for `LOCKED` (never color alone), and a clear locked indicator wherever the timesheet is later viewed.

### Tests
- Unit: the `APPROVED`-only lifecycle guard; the Nova-only permission check.
- Integration: locked timesheets reject every mutation path (status change, entry edit) server-side; the audit event is distinct from the approval event.
- Component: the Lock action and its confirmation step; the locked indicator on a read-only timesheet view.
- E2E: a coordinator locks an approved timesheet and confirms no edit path remains available to the participant or the shelter.

### Out of scope
The adjustment/correction workflow for a `LOCKED` (or already-`APPROVED`) record — a distinct, not-yet-built capability, per `docs/product/business-rules.md`: "Locked records require adjustment workflow." The funding-source hours rollup and report itself (Epic 7, Story 7.2). Payroll processing, payroll export or provider integration, and tax withholding/reporting — all deferred, not a blocker for this story (`docs/product/mvp.md`; `docs/product/v2-roadmap.md`: "Payroll export or provider integration"; `docs/planning/assumptions.md`, "Payroll and tax workflows" under Needs validation).

### Dependencies
6.5 (an `APPROVED` timesheet must exist), 1.4/1.5 (Nova roles and authorization context).
