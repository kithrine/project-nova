# Epic 5 — Active Placement

## Goal
Operate an active transitional placement.

## Stories

| ID | Story | Status |
|---|---|---|
| 5.1 | Placement workspace | Ready for Development |
| 5.2 | Assign site, supervisor, and schedule | Ready for Development |
| 5.3 | Assign funding | Ready for Development |
| 5.4 | Placement onboarding | Ready for Development |
| 5.5 | Activation blockers | Ready for Development |
| 5.6 | Activate placement | Ready for Development |
| 5.7 | Pause and resume | Ready for Development |
| 5.8 | Complete, convert, withdraw, or terminate | Blocked — pending policy validation |
| 5.9 | Case notes | Ready for Development |
| 5.10 | Evaluations | Ready for Development |
| 5.11 | Incidents | Ready for Development |

> Sequencing note: build 5.1 first as the shared workspace shell that later stories populate. 5.2, 5.3, and 5.4 supply the data that 5.5's blocker list evaluates, so sequence 5.2 → 5.3 → 5.4 → 5.5 → 5.6. 5.7 and 5.8 both require an Active placement (5.6) and are otherwise independent of each other; 5.8's Terminated path is additionally blocked on the open policy question in its Dependencies. 5.9 (Case Notes) has no lifecycle dependency and can be built in parallel with 5.2–5.6. 5.10 and 5.11 depend only on 5.1 for their authorization/data model, though exercising them end-to-end in tests is easiest once 5.6 exists.

---

## Story 5.1 — Placement workspace

### Status
Ready for Development

### User story
As a Program Coordinator, I want a single placement workspace showing identity, lifecycle stage, and tabbed detail, so that I can operate a placement without hunting across the system.

### Scope
- Build the Placement Workspace Header component (`docs/ux/component-guidelines.md`) showing the participant, host organization, site, current lifecycle stage, and the placement's human-readable placement number (`docs/architecture/database-design.md`).
- Build the Lifecycle Timeline showing every documented stage — Draft, Proposed, Shelter Review, Approved, Onboarding, Active, Paused, and the three terminal states — with the current stage clearly indicated.
- Build the tab shell exactly as specified in `docs/ux/wireframes-layouts.md`: Overview, Schedule, Hours, Evaluations, Incidents, Case Notes, Documents, Funding, History. Each tab is independently permission- and role-gated.
- Overview tab shows core identity fields: participant, host organization, site, supervisor, coordinator, schedule summary, funding summary, and current lifecycle stage.
- Build the activation-blockers-and-actions region that later stories populate (5.5 blocker list; 5.6/5.7/5.8 lifecycle actions).
- Produce three role-shaped view models over the same underlying Placement: Nova Operations (full), Shelter (no Case Notes tab, no internal-only fields), Participant (simplified "My Placement" view — no Case Notes, no other participants' data, no raw internal blocker codes).
- Documents tab lists placement-scoped Document records, reusing the upload capability established in Epic 2; this story does not add new upload functionality.
- Hours tab shows a read-only summary and a link into the participant's timesheets; full timesheet functionality is Epic 6.
- Implement the required screen states from `docs/ux/wireframe-spec.md`: Loading, Empty, Error, Permission denied, Restricted, Success, Disabled, Blocked, Concurrent update.

### Acceptance criteria
1. Given a Program Coordinator with `placement.view` permission and in-scope access, when they open a placement, then the workspace renders the header, the full lifecycle timeline, and all nine tabs listed in `docs/ux/wireframes-layouts.md`.
2. Given a Shelter Supervisor or Shelter Manager viewing a placement at their own organization, when the workspace renders, then the Case Notes tab is absent and no internal-only fields (for example, background status) appear anywhere in the response.
3. Given a Participant viewing their own placement, when the workspace renders, then they see a simplified "My Placement" view with no Case Notes, no other participants' data, and no raw internal blocker codes.
4. Given a placement in a terminal state (Completed, Converted to Permanent Employment, Withdrawn, or Terminated), when viewed, then the Lifecycle Timeline reflects that terminal state and no control that would reopen or further transition it is offered.
5. Given a user without `placement.view` permission or outside the resource's organization scope, when they request the workspace URL directly, then they receive the Permission denied state and no placement data is present in the response payload.
6. Given the workspace on a 360px viewport, when it renders, then the tabs collapse into a mobile-first pattern with no horizontal scroll and the primary next action remains reachable.

### Authorization
`placement.view` permission. Resource scope is the placement's host organization (Shelter roles), the linked participant (Participant role), or Nova-wide (Nova Operations roles). Tab and field visibility are enforced a second time at the server boundary — a hidden tab in the UI is never the only protection. The server returns a role-shaped view model per `docs/architecture/architecture.md`; raw Prisma records are never returned to the UI.

### Lifecycle rules
Read-only presentation of the Placement's current state; this story does not itself transition lifecycle (see 5.2, 5.6, 5.7, 5.8). Every documented stage from `docs/product/placement-lifecycle.md` — including Paused and all three terminal states — must render correctly, and terminal states never offer a reopening action, per RULES.md.

### Data changes
No new writes. Reads `Placement` and related records (`Schedule`, `FundingAssignment`, `Evaluation`, `Incident`, `CaseNote`, `Document`, lifecycle and audit events) through repositories that return shaped view models composed per role. May introduce a server-side composition service; no new tables.

### UX and accessibility
- Semantic landmarks and heading structure; tabs use a keyboard-operable pattern (roving tabindex/arrow keys) per WCAG 2.2 AA (`docs/ux/accessibility.md`).
- Current lifecycle stage and tab selection are indicated with text and icon, never color alone.
- Mobile-first tab collapse (scrollable or select-based) at small viewports, matching the responsive rules in `docs/ux/wireframe-spec.md`.
- Participant-facing copy is plain and respectful (`docs/ux/content-style-guide.md`); internal lifecycle-state names are translated to plain language in the participant view.

### Tests
- Unit: role-shaped view-model selection logic per role (Nova, Shelter, Participant).
- Integration: organization-scope enforcement; tab- and field-level exclusion verified at the repository/service layer, not just the UI.
- Component: header, lifecycle timeline (all stages), tab shell, and the Permission denied/Restricted/Empty/Loading states.
- E2E: a coordinator, a shelter user, and the linked participant each open the same placement and see their correct role-shaped workspace; a cross-organization shelter user is denied.

### Out of scope
Populating tab content beyond the Overview summary (5.2 site/supervisor/schedule, 5.3 funding, 5.4 onboarding, 5.5 blockers, 5.6–5.8 lifecycle actions, 5.9 case notes, 5.10 evaluations, 5.11 incidents); timesheet creation/approval (Epic 6 — the Hours tab here is a read-only summary); document upload (Epic 2); reporting/export (Epic 7).

### Dependencies
Epic 4 Story 4.8 (a Placement must exist, created from an approved match) provides the initial record this workspace displays. Epic 1 Stories 1.5 (authorization context) and 1.7 (protected layouts). `docs/ux/wireframes-layouts.md` Placement workspace pattern.

---

## Story 5.2 — Assign site, supervisor, and schedule

### Status
Ready for Development

### User story
As a Program Coordinator, I want to assign the host site, supervisor, and work schedule to a placement and route it through shelter review, so that the placement has the concrete operational details required before it can be approved and activated.

### Scope
- Form to select an Organization Site (must belong to the placement's host organization), assign a Shelter Supervisor (must hold an active Shelter Supervisor or Shelter Manager membership at that site's organization), and confirm or reassign the coordinator of record.
- Schedule builder capturing days, times, and weekly hours target (Decimal, per RULES.md).
- Propose action: once site, supervisor, and schedule are set, the coordinator proposes the placement, moving it Draft → Proposed → Shelter Review; the proposed placement appears in the Shelter Manager's placement-approvals queue (`docs/ux/wireframes-layouts.md` Shelter dashboard).
- Shelter Manager review action: approves the site/supervisor/schedule package (Shelter Review → Approved) or requests changes, returning it to the coordinator for revision rather than a dead end — mirroring the Change Requested pattern used for matches in Epic 4.
- Conflicting-placement check: a participant may hold only one Onboarding, Active, or Paused placement at a time (`docs/product/business-rules.md`); assigning/proposing is blocked if the participant already holds one.
- Reassignment (for example, a supervisor change mid-placement) is supported and preserves history.

### Acceptance criteria
1. Given a Draft placement linked to an approved match, when a coordinator selects a site belonging to the placement's host organization, then the assignment is saved and the site appears on the Overview tab.
2. Given a site assignment, when the coordinator assigns a supervisor, then only users holding an active Shelter Supervisor or Shelter Manager membership at that organization are selectable.
3. Given site, supervisor, and schedule are all set, when the coordinator proposes the placement, then it transitions Draft → Proposed → Shelter Review and appears in the shelter's placement-approvals queue.
4. Given a placement in Shelter Review, when the Shelter Manager approves the site/supervisor/schedule package, then the placement transitions to Approved and a lifecycle event is recorded with actor and timestamp.
5. Given a participant who already holds another Onboarding, Active, or Paused placement, when a coordinator attempts to propose this placement, then the action is blocked and the conflicting-placement rule is cited.
6. Given an assigned supervisor whose membership later becomes inactive, when the placement is viewed, then the assignment history is preserved unchanged and an activation blocker (5.5) surfaces requiring reassignment.

### Authorization
`placement.assign` for Program Coordinators and Nova Administrators, scoped to Nova. `placement.approve` for the Shelter Manager, scoped to their own organization and gated to the Shelter Review lifecycle state. Shelter Supervisors have read-only access to the assignment.

### Lifecycle rules
Enacts Draft → Proposed → Shelter Review → Approved, using the exact state names from `docs/product/placement-lifecycle.md`. This is the placement-level shelter gate — the Shelter Manager approving the specific site, supervisor, and schedule — distinct from the match-level shelter approval in Epic 4 (`docs/decisions/ADR-013-placement-review-model.md`). Each transition writes a lifecycle event (actor, timestamp, from-state, to-state). A change-request response from the shelter returns the placement to the coordinator for revision instead of terminating the flow.

### Data changes
Writes to `Placement` (`siteId`, `supervisorUserId`, `coordinatorUserId`) and a `Schedule` record linked to the placement, plus lifecycle events. The one-Onboarding/Active/Paused-placement-per-participant partial unique index (`docs/architecture/database-design.md`) is the database-level backstop to the application-level conflict check.

### UX and accessibility
Form Field and Select components with labels above inputs; site and supervisor selects show the organization scope explicitly so users understand why options are limited. The schedule builder is fully keyboard-operable, not drag-and-drop-only (`docs/ux/accessibility.md`). The Status Transition Control is used for propose/approve/request-changes actions, each with a Confirmation Panel rather than a generic status dropdown (RULES.md).

### Tests
- Unit: site/supervisor eligibility validation; schedule shape and Decimal hours validation.
- Integration: partial unique index rejects a second concurrent Onboarding/Active/Paused placement for the same participant; each lifecycle transition writes its event transactionally.
- Component: assignment form, Status Transition Control, and the change-request path.
- E2E: coordinator assigns and proposes a placement; Shelter Manager approves it; the placement reaches Approved with full history visible.

### Out of scope
Funding assignment (5.3), onboarding tasks (5.4), activation itself (5.6), and organization-level site/supervisor setup (shelter partner onboarding, `docs/ops/shelter-onboarding.md`, handled outside this epic).

### Dependencies
5.1 (workspace hosting this UI). Epic 4 (approved match and host organization already linked). Shelter Organization/Site/Membership records established via `docs/ops/shelter-onboarding.md` and Epic 1 Story 1.4.

---

## Story 5.3 — Assign funding

### Status
Ready for Development

### User story
As a Grant Administrator, I want to assign exactly one active funding source to a placement, so that the placement's hours and costs are attributed to the correct grant.

### Scope
- Select an existing Funding Source and create a Funding Assignment linking it to the Placement with an effective start date.
- Enforce exactly one active Funding Assignment per placement at a time (ADR-010; partial unique index per `docs/architecture/database-design.md`) — ending the current assignment before a new one can become active.
- Preserve Funding Assignment history; prior assignments remain visible on the Funding and History tabs and are never deleted.
- Any rate or hour-cap fields captured on the assignment use Decimal, never floating point (RULES.md).
- Approved-hours-by-funding-source reporting is not built here (Epic 7).

### Acceptance criteria
1. Given a placement with no active funding assignment, when a Grant Administrator assigns a Funding Source, then a Funding Assignment record is created with status Active and an effective start date.
2. Given a placement that already has an active Funding Assignment, when a user attempts to assign a second active Funding Source, then the action is rejected and the partial unique index prevents two simultaneous active assignments at the database layer.
3. Given an active Funding Assignment, when the coordinator or Grant Administrator ends it (for example, a grant year change), then it is marked ended with an end date and preserved in the Funding tab history.
4. Given a new Funding Assignment replaces an ended one, when saved, then exactly one active assignment exists at any time and both records remain queryable in History.
5. Given a user without `funding.assign` permission, when they attempt to assign or end a funding assignment, then the action is denied server-side regardless of client state.
6. Given money or hour-cap fields on the Funding Assignment, when stored, then they use Decimal types, never floating point.

### Authorization
`funding.assign` scoped to Nova Operations (Grant Administrator primary; Program Coordinator per the role mapping in `docs/architecture/authorization-rbac.md`), organization scope = Nova. Shelters do not assign funding and do not see funder financial detail beyond what the Funding tab is explicitly designed to show them, per the privacy rule in `docs/product/business-rules.md` ("Shelters cannot view raw applications, background details, or internal Nova notes").

### Lifecycle rules
The Funding Assignment is a satellite record to Placement, not a placement-lifecycle state itself. It feeds the "active funding assignment" activation prerequisite (5.5/5.6). Ending an assignment on an Active placement does not itself pause or terminate the placement; its absence blocks (re)activation until resolved.

### Data changes
Adds `FundingAssignment` (`placementId`, `fundingSourceId`, `status`, `startDate`, `endDate`, optional rate/hour-cap as Decimal), with a partial unique index enforcing one active row per `placementId`. This story assumes `FundingSource` master records already exist; they are created and managed in Epic 1 Story 1.8 (Manage funding sources).

### UX and accessibility
Funding Assignment Card component (`docs/ux/component-guidelines.md`); amounts are right-aligned, formatted, and unit-labeled. Active versus ended assignments are distinguished with text and icon, never color alone. History is presented as an accessible, clearly dated list.

### Tests
- Unit: Decimal handling; one-active-assignment invariant logic.
- Integration: partial unique index enforcement under concurrent write attempts.
- Component: Funding Assignment Card, assign/end flows, Permission denied state.
- E2E: Grant Administrator assigns funding and the placement's funding-related activation blocker clears.

### Out of scope
Funding Source master-record creation and management (Epic 1 Story 1.8 — Manage funding sources). Approved-hours-by-funding-source reporting (Epic 7 Story 7.2). Blended or multiple simultaneous funding sources — explicitly deferred (RULES.md, ADR-010).

### Dependencies
5.1 (workspace Funding tab). Epic 1 Story 1.8 (Funding Source master records must exist). ADR-010. `docs/ops/grant-operations.md`. The partial unique index convention in `docs/architecture/database-design.md`.

---

## Story 5.4 — Placement onboarding

### Status
Ready for Development

### User story
As a Program Coordinator, I want placement-specific onboarding tasks generated and tracked to completion, so that the participant and shelter finish the required steps before the placement can activate.

### Scope
- Generate a set of onboarding tasks scoped to the Placement once it reaches Approved — distinct from the Program Enrollment onboarding tasks generated in Epic 3 (Stories 3.2/3.3). An Onboarding Task belongs to exactly one owning context, Program Enrollment or Placement, never both (XOR ownership, `docs/architecture/database-design.md`).
- Task catalog covers placement-specific, participant-facing steps such as site orientation, safety-procedure acknowledgment, PPE/uniform issuance, and the confidentiality/workplace-conduct agreement — separate from the one-time, organization-level shelter partner onboarding described in `docs/ops/shelter-onboarding.md`, which establishes the site and its procedures before any placement exists.
- Participants complete participant-facing tasks from their dashboard ("My Placement"); Shelter Supervisors, Shelter Managers, or the coordinator verify shelter-side tasks (for example, "orientation delivered").
- Task completion feeds the "Onboarding complete" activation prerequisite evaluated in 5.5/5.6.
- Reuses the Task List component and Onboarding Task data pattern established in Epic 3.

### Acceptance criteria
1. Given a placement that has reached Approved, when placement onboarding is initiated, then the system generates the placement's onboarding task set linked to this placement, not to the participant's Program Enrollment.
2. Given an onboarding task owned by a placement, when queried, then it has exactly one owning context (this Placement) and never simultaneously belongs to a Program Enrollment.
3. Given a participant-facing task such as "Acknowledge site safety procedures," when the participant marks it complete from My Placement, then it is recorded complete with a timestamp and the participant as actor.
4. Given a shelter- or coordinator-verified task such as "Orientation delivered," when marked complete by an authorized Shelter Supervisor, Shelter Manager, or coordinator, then it is recorded with the verifying actor.
5. Given placement onboarding tasks are incomplete, when the placement's activation blockers are evaluated (5.5), then "Onboarding complete" remains an active blocker until all required tasks are done.
6. Given the placement later reaches a terminal state, when onboarding tasks are viewed, then incomplete tasks are preserved as historical record, not deleted.

### Authorization
Participants may complete only their own placement's participant-facing tasks (resource scope = self). Shelter Supervisors and Shelter Managers may complete shelter-facing tasks scoped to their organization's placements. Program Coordinators hold full manage permission within Nova scope. Tasks are generally only actionable while the placement is Approved or Onboarding; this is enforced server-side, never trusted from the client.

### Lifecycle rules
Task generation is tied to the placement reaching Approved and entering Onboarding. Task completion does not itself transition the placement — activation (5.6) is a separate, explicit action gated by the blocker list. Tasks are never hard-deleted.

### Data changes
Adds `OnboardingTask` rows (or reuses the Epic 3 `OnboardingTask` model) with an owning-context discriminator that enforces XOR between `programEnrollmentId` and `placementId`, per `docs/architecture/database-design.md`. Records completion actor and timestamp per task.

### UX and accessibility
Task List component with clear required/optional labeling; completion status conveyed with text and icon, never color alone. Participant-facing copy follows `docs/ux/content-style-guide.md` ("Complete before your first day" rather than internal jargon). Accessible checkbox/action controls; no drag-and-drop-only interactions.

### Tests
- Unit: XOR ownership validation; task-catalog generation on reaching Approved.
- Integration: task completion scoped correctly by role and organization; the database constraint prevents dual ownership.
- Component: Task List empty, in-progress, complete, and restricted states.
- E2E: participant completes their tasks, a supervisor verifies theirs, and the corresponding activation blocker clears.

### Out of scope
Program Enrollment onboarding (Epic 3, pre-matching); training and certification tracking (Epic 3 Stories 3.4/3.5, consumed as a separate activation prerequisite, not generated here); activation itself (5.6).

### Dependencies
5.2 (site, supervisor, and schedule — some tasks reference them) and generally follows the placement reaching Approved. Epic 3's Onboarding Task pattern and data model. The XOR ownership constraint in `docs/architecture/database-design.md`.

---

## Story 5.5 — Activation blockers

### Status
Ready for Development

### User story
As a Program Coordinator, I want a single, accurate list of everything preventing a placement from activating, so that I always know the next required action instead of guessing.

### Scope
- Compute and render the Blocker List component evaluating exactly the ten activation prerequisites from `docs/product/placement-lifecycle.md`: valid enrollment, participant accepted, shelter approved, host and site assigned, supervisor and coordinator assigned, onboarding complete, training and certifications complete, schedule confirmed, active funding assignment, and no conflicting active placement.
- Each blocker links to the tab or action that resolves it (for example, "Assign a funding source" links to the Funding tab from 5.3).
- Blocker evaluation is computed server-side, not derived on the client, and reflects current data on every load so it cannot drift from the true unmet-prerequisite state.
- Surface blockers prominently in the workspace's blockers-and-actions region (5.1) and, for urgent cases, on the Operations dashboard's "Urgent blockers" surface (`docs/ux/wireframes-layouts.md`).

### Acceptance criteria
1. Given a placement missing one or more activation prerequisites, when the workspace loads, then the blocker list shows exactly the unmet prerequisites, each named per `docs/product/placement-lifecycle.md`, with no extraneous or invented items.
2. Given a placement with all ten prerequisites satisfied, when the blocker list is evaluated, then it renders empty and the Activate action (5.6) becomes available.
3. Given a blocker is resolved (for example, funding is assigned), when the workspace is next loaded, then that blocker no longer appears, reflecting server truth rather than a stale client cache.
4. Given a participant already holds another Onboarding, Active, or Paused placement, when this placement's blockers are evaluated, then "no conflicting active placement" appears as an open blocker naming the conflict.
5. Given a coordinator lacks permission to resolve a specific blocker (for example, only a Grant Administrator can assign funding), when they view that blocker, then the linked action is visible but its control remains independently permission-gated.
6. Given a placement is already Active or in a terminal state, when viewed, then the blocker list is not shown, since blockers apply only before activation.

### Authorization
`placement.view` to see the blocker list. Each linked action is independently authorized by its own permission (`funding.assign`, `placement.assign`, and so on) — the blocker list itself never grants elevated access, it only surfaces state.

### Lifecycle rules
Blockers apply while the placement is pre-Active (Draft through Onboarding). The list is derived, read-only state, not a lifecycle state itself, and is the authoritative gate consumed by 5.6's activation check.

### Data changes
No new persistent records. Computed from `Placement`, `ProgramEnrollment`, the Placement Match's participant/shelter decisions, site/supervisor/coordinator assignment, `OnboardingTask`, Training Enrollment/Certification, `Schedule`, and `FundingAssignment`. May add a server-side aggregation service; no new table.

### UX and accessibility
Blocker List component with text-and-icon severity, never color alone; each item is keyboard-actionable and linked to its resolving tab or action. Blocker copy is plain language (for example, "Assign a funding source," not an internal status code) per `docs/ux/content-style-guide.md`. Changes to the list are announced to assistive technology.

### Tests
- Unit: blocker computation against each of the ten prerequisites individually and in combination.
- Integration: blocker state reflects real data across Placement, Enrollment, Training, Funding, and Onboarding after writes from other stories.
- Component: Blocker List rendering, linking, empty state, and keyboard navigation.
- E2E: a coordinator resolves each blocker in turn and watches the list shrink to empty, then activates the placement.

### Out of scope
Resolving the blockers themselves — each is owned by its respective story (5.2, 5.3, 5.4, or Epic 3 training); the Activate action itself (5.6).

### Dependencies
5.1 (hosting UI). 5.2, 5.3, and 5.4 (data sources). Epic 3 (training, certification, and enrollment data). The activation prerequisite list in `docs/product/placement-lifecycle.md` is authoritative and must be matched exactly.

---

## Story 5.6 — Activate placement

### Status
Ready for Development

### User story
As a Program Coordinator, I want to activate a placement only when every prerequisite is genuinely met, so that participants never start work on an unsafe or non-compliant placement.

### Scope
- The Activate action, available only when the 5.5 blocker list is empty.
- Full server-side re-validation of all ten activation prerequisites at the moment of activation, inside a single transaction — never trusting a stale client-side "blockers clear" state.
- Transitions the placement Onboarding → Active, writes a lifecycle event (actor, timestamp, from-state, to-state), and records the activation date as the participant's effective start date.
- Confirms the one-Onboarding/Active/Paused-placement-per-participant invariant at the database layer as part of the same transaction.
- Does not create timesheets or schedule evaluations/incidents — those remain owned by Epic 6 and by 5.10/5.11 respectively.

### Acceptance criteria
1. Given a placement with zero open activation blockers, when a coordinator with `placement.activate` permission activates it, then the placement transitions Onboarding → Active inside a transaction and a lifecycle event is recorded.
2. Given a placement with at least one open blocker, when activation is attempted — including a direct or replayed request that bypasses the UI — then the server rejects the transition and no partial state change occurs.
3. Given two concurrent activation attempts on the same placement, when both are submitted, then exactly one succeeds, the other fails cleanly, and no duplicate lifecycle events are written.
4. Given activation succeeds, when the participant's other placements are checked, then the one-Onboarding/Active/Paused-placement-per-participant partial unique index guarantees no conflicting placement exists.
5. Given activation succeeds, when the workspace is viewed, then the Lifecycle Timeline shows Active as the current stage and the activation event appears in History with actor and timestamp.
6. Given a user without `placement.activate` permission, when they attempt activation, then it is denied server-side regardless of UI state.

### Authorization
`placement.activate` scoped to Nova Operations (Program Coordinator, Nova Administrator), consistent with `docs/product/mvp.md` placing "Lifecycle transitions" under Nova Operations. Never available to Shelter or Participant roles.

### Lifecycle rules
Enacts Onboarding → Active exactly as named in `docs/product/placement-lifecycle.md`. Full prerequisite re-validation is mandatory server-side at transition time, inside a transaction, per RULES.md ("Use transactions for critical transitions"), and the transition writes a lifecycle event per RULES.md ("Write audit events for sensitive actions").

### Data changes
Updates `Placement.status` to Active, sets the activation/start timestamp, and writes a `PlacementLifecycleEvent` row. Relies on the partial unique index (one Onboarding/Active/Paused placement per participant) as the database-level backstop.

### UX and accessibility
Status Transition Control with an explicit Confirmation Panel before this transition. Success is clearly distinguished from blocked/disabled state using text and icon, not color alone. The Activate control is disabled — not hidden — with an explanation when blockers remain, so users understand why they cannot proceed.

### Tests
- Unit: server-side prerequisite re-validation logic, independent of the 5.5 UI computation.
- Integration: transactional activation; concurrent-activation race handled correctly; partial unique index enforcement.
- Component: Activate control's disabled/enabled states and confirmation flow.
- E2E: full path — resolve all blockers from 5.2–5.4 and Epic 3 training, then activate; separately, attempt a blocked activation and confirm rejection.

### Out of scope
Timesheet creation, evaluation scheduling, or incident-reporting activation (independent capabilities in 5.9–5.11 and Epic 6). Reactivating a terminal placement — never permitted, since terminal states are not reopened.

### Dependencies
5.5 (blocker computation, re-verified here server-side). 5.2, 5.3, 5.4, and Epic 3 (the data that must be complete). The partial unique index convention in `docs/architecture/database-design.md`.

---

## Story 5.7 — Pause and resume

### Status
Ready for Development

### User story
As a Program Coordinator, I want to pause an active placement and later resume it, so that temporary interruptions — medical leave, a shelter closure, personal circumstances — are reflected accurately without ending the placement.

### Scope
- Pause action: Active → Paused, capturing a reason/category and effective date.
- Resume action: Paused → Active, capturing a resume date.
- Full history of pause/resume cycles preserved — a placement may be paused and resumed multiple times, matching the Active ⇄ Paused loop in `docs/product/placement-lifecycle.md`.
- Paused status is visible everywhere the placement appears (workspace, dashboards) so downstream capabilities (for example, Epic 6 timesheet expectations) can account for it, though that consumption is out of scope here.

### Acceptance criteria
1. Given an Active placement, when a coordinator with `placement.pause` permission pauses it with a reason, then it transitions Active → Paused, records the reason and effective date, and writes a lifecycle event.
2. Given a Paused placement, when a coordinator with `placement.resume` permission resumes it, then it transitions Paused → Active, records the resume date, and writes a lifecycle event.
3. Given a placement is paused and resumed multiple times, when History is viewed, then every pause/resume cycle is preserved in order with actor, reason, and timestamps — none overwritten.
4. Given a placement in any state other than Active, when a Pause action is attempted, then it is rejected; given a placement in any state other than Paused, when a Resume action is attempted, then it is rejected.
5. Given a Paused placement, when other placement-dependent activity (for example, Epic 6 timesheet submission) is attempted, then that activity can detect the Paused status via the placement's current state.
6. Given a user without `placement.pause`/`placement.resume` permission — including Shelter roles — when they attempt to pause or resume, then the action is denied server-side. Shelter users have no lifecycle-transition capability in MVP (`docs/product/mvp.md` places "Lifecycle transitions" only under Nova Operations); they may document circumstances through Case Notes (5.9) or Incidents (5.11) that prompt a coordinator to act.

### Authorization
`placement.pause` and `placement.resume` scoped to Nova Operations only (Program Coordinator, Nova Administrator). Shelter and Participant roles have no pause/resume capability in MVP.

### Lifecycle rules
Enacts Active → Paused and Paused → Active only, matching the Active ⇄ Paused loop in `docs/product/placement-lifecycle.md`; any other source state is rejected. Every cycle is fully historized and never overwritten.

### Data changes
Updates `Placement.status` and writes a `PlacementLifecycleEvent` row (with reason/category and actor) for each pause and each resume. No hard deletes.

### UX and accessibility
Status Transition Control plus a Confirmation Panel requiring a reason. The Lifecycle Timeline visually and textually distinguishes Paused from Active using text and icon, not color alone. Paused placements are clearly labeled across dashboards and lists.

### Tests
- Unit: valid-transition guard — only Active→Paused and Paused→Active are permitted.
- Integration: multi-cycle history persists correctly; writes are transactional.
- Component: Pause/Resume controls, required-reason form, and disabled state on an invalid source state.
- E2E: a coordinator pauses an active placement, resumes it, and confirms both events appear in History.

### Out of scope
Automatic pause triggers (for example, from an incident) — pause is always an explicit coordinator action in MVP. Timesheet/hours handling during a pause (Epic 6).

### Dependencies
5.6 (the placement must reach Active first). 5.1 (workspace hosting).

---

## Story 5.8 — Complete, convert, withdraw, or terminate

### Status
Blocked — pending policy validation

### User story
As a Program Coordinator, I want to move a placement to its appropriate terminal outcome — Completed, Converted to Permanent Employment, Withdrawn, or Terminated — so that the participant's record accurately reflects how the placement ended.

### Scope
- Four distinct terminal transitions from Active or Paused: Completed (successful natural end), Converted to Permanent Employment (participant hired permanently, feeding an Employment Outcome record), Withdrawn (participant-initiated end), Terminated (involuntary end).
- Each transition captures a reason/category, an effective date, and a free-text summary where relevant; Converted to Permanent Employment additionally creates or links an Employment Outcome record.
- Terminal placements are never reopened (RULES.md; `docs/product/business-rules.md`) — no UI path exists back to Active from any of the four terminal states.
- Completed, Converted to Permanent Employment, and Withdrawn can proceed under the standard Nova-Operations lifecycle-transition pattern (`docs/product/mvp.md`). The Terminated transition's authorization is not yet defined (see Status and Dependencies) and must not be built as a guess.

### Acceptance criteria
1. Given an Active or Paused placement reaching its planned end date successfully, when a coordinator marks it Completed, then the placement transitions to the terminal Completed state with an effective date and lifecycle event.
2. Given a participant is hired permanently during or at the end of a placement, when a coordinator records Converted to Permanent Employment, then the placement transitions to that terminal state and an Employment Outcome record is created or linked in the same transaction.
3. Given a participant chooses to leave the placement voluntarily, when a coordinator records Withdrawn with the participant's stated reason, then the placement transitions to the terminal Withdrawn state.
4. Given a placement reaches any terminal state, when later viewed, then no action in the UI permits reopening it or transitioning it further — the workspace shows only historical detail consistent with the viewer's role.
5. Given the Terminated outcome, when its implementation is scoped, then it must follow the same mechanics as the other three transitions (reason, effective date, lifecycle event, transaction) but its permission gating cannot be finalized or shipped until the authorized role(s) are confirmed (see Dependencies).
6. Given any terminal transition completes, when it is recorded, then the lifecycle event (and, for Conversion, the Employment Outcome linkage) is written in the same transaction, so no terminal state is ever recorded without full history.

### Authorization
Completed, Converted to Permanent Employment, and Withdrawn: a `placement.complete`-family permission scoped to Nova Operations (Program Coordinator, Nova Administrator), consistent with `docs/product/mvp.md` placing "Lifecycle transitions" under Nova Operations. Terminated: no permission holder is defined yet. `docs/planning/assumptions.md` lists "Who may terminate a placement" under Needs validation — implementation must gate behind a named permission (for example, `placement.terminate`) once a role (and any required approval chain, such as whether a Shelter Manager can request termination versus only report incidents that lead a coordinator to act) is confirmed. Do not default to a guessed role.

### Lifecycle rules
Enacts Active/Paused → {Completed | Converted to Permanent Employment | Withdrawn | Terminated}, the four terminal states in `docs/product/placement-lifecycle.md`. All four are terminal: RULES.md and `docs/product/business-rules.md` both state terminal placements are never reopened, and no transition originates from a terminal state.

### Data changes
Updates `Placement.status` to the chosen terminal value, writes a `PlacementLifecycleEvent` with reason/category/effective date/actor, and for Conversion creates or links an `EmploymentOutcome` record. No hard deletes, ever (RULES.md).

### UX and accessibility
Each terminal action uses its own clearly labeled Status Transition Control — never a generic status dropdown (RULES.md) — with a Confirmation Panel naming the irreversible nature of the choice in plain language. Participant-facing summaries, where they exist, use respectful, non-punitive language per `docs/ux/content-style-guide.md`, especially for Withdrawn and Terminated.

### Tests
- Unit: each of the four transitions validated as Active/Paused-origin only; terminal-state immutability guard.
- Integration: transactional terminal write plus Employment Outcome linkage for Conversion; no reopening possible at the repository layer.
- Component: the distinct action controls, confirmation copy, and disabled state once terminal.
- E2E: a coordinator completes a placement and, separately, converts one to permanent employment and confirms an Employment Outcome appears. (Terminated-path E2E coverage is added once the policy question resolves.)

### Out of scope
Employment Outcome detail/follow-up tracking beyond creation and linkage. Re-application or re-enrollment after a terminal placement (governed by the application rules in `docs/product/business-rules.md`, not this story).

### Dependencies
**Blocked — pending policy validation.** `docs/planning/assumptions.md` lists "Who may terminate a placement" under Needs validation. The Terminated transition's authorization must be resolved before this story can be fully built and shipped; because Terminated is one of the four outcomes this single story delivers, the story as a whole is blocked even though Completed/Converted/Withdrawn are independently well-specified. Also depends on 5.6/5.7 (the placement must be Active or Paused) and the Employment Outcome model (`docs/architecture/domain-model.md`).

---

## Story 5.9 — Case notes

### Status
Ready for Development

### User story
As a Program Coordinator, I want to keep internal case notes on a placement, so that Nova Operations has a running coordination record that is never exposed to participants or shelters.

### Scope
- Case Note Composer for Nova Operations users to add timestamped, authored notes to a placement.
- Notes are visible only within Nova Operations scope — never rendered in Shelter or Participant view models, enforced server-side, not merely hidden in the UI.
- XOR ownership: a Case Note belongs to exactly one owning context; in this epic that context is the Placement (`docs/architecture/database-design.md`).
- Notes are historical entries: edits preserve prior content rather than silently overwriting it.
- Case Notes tab in the Placement workspace (5.1) renders only for Nova Operations role-shaped views.

### Acceptance criteria
1. Given a Program Coordinator viewing a placement, when they add a case note, then it is saved with author and timestamp and appears in the Case Notes tab.
2. Given a Shelter Supervisor or Shelter Manager viewing the same placement, when their role-shaped workspace is rendered, then the Case Notes tab and all case-note content are absent entirely, not merely visually hidden.
3. Given a Participant viewing their own placement, when their role-shaped workspace is rendered, then case notes are absent entirely.
4. Given a case note is created, when queried at the data layer, then it has exactly one owning context — this Placement — satisfying the XOR ownership constraint.
5. Given an existing case note, when a coordinator edits it, then the prior content is preserved in history rather than overwritten silently.
6. Given a placement reaches a terminal state, when case notes are viewed, then they remain accessible to Nova Operations as historical record and are not deleted.

### Authorization
`casenote.view` and `casenote.create` restricted to Nova Operations roles (Program Coordinator, Nova Administrator, and the optional Restricted Review Specialist where configured), scoped to Nova. Never granted to Shelter or Participant roles, enforced at the query/repository layer per AGENTS.md ("Never expose internal case notes to participants or shelters").

### Lifecycle rules
Case notes may be added at any placement lifecycle stage, including terminal states, since coordination history continues to matter after a placement ends. Adding a note does not itself change placement lifecycle state.

### Data changes
Adds `CaseNote` (`placementId` per XOR ownership, `authorId`, `body`, `createdAt`, and an edit-history mechanism). Excluded from every query path that produces Shelter- or Participant-scoped view models.

### UX and accessibility
Case Note Composer clearly labeled as internal-only so coordinators understand its visibility scope. Accessible text entry with labeled fields; notes list in reverse-chronological order with author and timestamp always visible, distinguished by text, not color alone.

### Tests
- Unit: XOR ownership validation; edit-history behavior.
- Integration: repository-level proof that Shelter- and Participant-scoped queries cannot return `CaseNote` rows under any parameter combination.
- Component: Case Notes tab present/absent per role; Composer behavior.
- E2E: a coordinator adds a note; a shelter user and a participant are each independently confirmed to have zero visibility into it, including via direct URL or API attempts.

### Out of scope
Case notes on other aggregates (Application, Program Enrollment), if they exist — owned by their respective epics. Notifications or alerts on new case notes (messaging is deferred to V2 per `docs/planning/assumptions.md`).

### Dependencies
5.1 (workspace tab). AGENTS.md sensitive-data rule. The XOR ownership convention in `docs/architecture/database-design.md`. Classification in `docs/architecture/security-privacy.md`.

---

## Story 5.10 — Evaluations

### Status
Ready for Development

### User story
As a Shelter Supervisor, I want to submit periodic evaluations of a participant's placement performance, so that Nova Operations and the participant's record reflect real workplace feedback.

### Scope
- Evaluation Form for Shelter Supervisors and Shelter Managers to submit structured evaluations (performance areas, ratings/comments, date) tied to the Placement, consistent with `docs/product/mvp.md` placing "Evaluations" under the Shelter Portal and the Shelter flow in `docs/ux/user-flows.md` ("Approve hours → Evaluate → Report incident").
- Nova Operations can view all evaluations for placements within their scope.
- Evaluations tab in the Placement workspace (5.1) lists past evaluations chronologically.
- Participant visibility into their own evaluation content is an open question (see Dependencies); this story builds the shelter-submission and Nova-Operations-review core now and does not expose evaluation content to the participant until that question is resolved.

### Acceptance criteria
1. Given an Active placement, when a Shelter Supervisor with `evaluation.create` permission scoped to that organization submits an evaluation, then it is saved with author, date, and structured content, and appears in the Evaluations tab.
2. Given a submitted evaluation, when a Program Coordinator views the placement, then they can see the full evaluation, scoped to placements within their caseload/organization access.
3. Given a Shelter Supervisor from a different organization, when they attempt to view or submit an evaluation for this placement, then access is denied by resource scope.
4. Given an evaluation is submitted, when later viewed, then it cannot be silently altered — any permitted edit preserves the prior content as history.
5. Given a placement that has not yet reached Active (still Draft, Proposed, Shelter Review, Approved, or Onboarding), when an evaluation submission is attempted, then it is rejected as outside the valid lifecycle window.
6. Given the participant-visibility question is unresolved, when a participant views My Placement, then evaluation content is not exposed, defaulting closed per the least-privilege posture in `docs/architecture/authorization-rbac.md` and `docs/ops/data-governance.md`.

### Authorization
`evaluation.create` for Shelter Supervisors and Shelter Managers, scoped to their organization and gated to the placement being Active or Paused. `evaluation.view` for Nova Operations, scoped to caseload/organization. `evaluation.view` for Participant is undecided and defaults to denied until resolved (see Dependencies). Cross-organization access is always denied.

### Lifecycle rules
Evaluations are submitted while a placement is Active or Paused; historical evaluations remain visible after the placement reaches a terminal state. Submitting an evaluation does not itself change placement lifecycle state.

### Data changes
Adds `Evaluation` (`placementId`, `authorId`, `submittedAt`, structured rating/comment fields). Never hard-deleted; retained as history per `docs/ops/data-governance.md`.

### UX and accessibility
Evaluation Form component with labeled rating scales — ratings are paired with text/numeric labels, never color-only. Plain-language prompts, accessible for keyboard and screen reader. Evaluations tab presents entries in an accessible list with clear dates and authorship.

### Tests
- Unit: permission/scope/lifecycle-state gating logic for evaluation creation.
- Integration: cross-organization denial; history preservation on edit.
- Component: Evaluation Form validation and accessible rating controls; Evaluations tab list states.
- E2E: a shelter supervisor submits an evaluation, a coordinator views it, and a different shelter's user is denied access.

### Out of scope
Automated evaluation scheduling or reminders (messaging/notifications are V2). Participant-facing evaluation display — blocked on the open policy question below. Aggregate evaluation reporting (Epic 7).

### Dependencies
Participant access to evaluations is unresolved: `docs/planning/assumptions.md` lists it under Needs validation. The shelter-submission and Nova-Operations-review core of this story is Ready for Development; participant-facing evaluation visibility must not ship until that policy question is answered. Also depends on 5.1 (workspace tab) and 5.6 (the placement must generally be Active).

---

## Story 5.11 — Incidents

### Status
Ready for Development

### User story
As a Shelter Supervisor, I want to report a workplace incident with the right category and severity, so that Nova Operations is alerted appropriately and the event is documented — understanding that reporting it here does not substitute for calling emergency services when needed.

### Scope
- Incident Form for Shelter Supervisors, Shelter Managers, and Nova Operations to report an incident against a Placement with a category (Safety, Injury, Animal welfare, Attendance, Conduct, Property, Harassment, Other) and a severity (Minor, Moderate, Serious, Emergency), exactly as defined in `docs/ops/incident-response.md`.
- A prominent, unmissable notice on the form: submitting it does not replace calling emergency services — the record is documentation and notification, not emergency response (RULES.md: "Never... Treat form submission as emergency response").
- Serious and Emergency severity immediately alert Nova Operations through an in-app urgent surface (for example, the Operations dashboard's urgent-items queue, `docs/ux/wireframes-layouts.md`). Real-time push/SMS/email alerting is not built, since messaging is deferred to V2 (`docs/planning/assumptions.md`); the MVP alert is an always-visible, in-app urgent queue item.
- Shelter users may report and add permitted follow-up only; they cannot change category or severity, or close an incident, once submitted.
- Nova Operations owns review, classification confirmation, and closure.
- Sensitive incident detail (for example, Serious/Emergency narratives, harassment specifics) is restricted: excluded from general search and from any role without explicit permission, per `docs/architecture/security-privacy.md` ("Serious incident investigations" is a named Highly restricted example).
- Incidents are never hard-deleted; they are historical records (`docs/ops/incident-response.md`).
- Incidents tab in the Placement workspace (5.1).

### Acceptance criteria
1. Given a Shelter Supervisor reporting an incident, when they submit the Incident Form, then they must select exactly one category and one severity from the fixed lists in `docs/ops/incident-response.md`, and the form displays a persistent notice that submission does not replace emergency services.
2. Given an incident is submitted with severity Serious or Emergency, when saved, then Nova Operations is immediately alerted through an in-app urgent surface, separate from routine incident intake.
3. Given an incident has been reported, when a Shelter Supervisor or Shelter Manager adds follow-up, then only permitted follow-up fields are editable by them — category, severity, and closure status are not shelter-editable.
4. Given an incident is under Nova Operations review, when a Program Coordinator or Nova Administrator with `incident.review` permission closes it, then the closure is recorded with reviewer, timestamp, and outcome, and the incident becomes read-only history.
5. Given an incident is marked with sensitive or restricted detail, when a general search or a non-permitted role queries incidents, then the restricted content is excluded from results and from that role's view entirely, not merely visually de-emphasized.
6. Given an incident record exists, when any user attempts to delete it through normal workflows, then the system prevents hard deletion — only archival/closure states are reachable.

### Authorization
`incident.create` for Shelter Supervisors and Shelter Managers (scoped to their organization's placements) and for Nova Operations. `incident.review` and `incident.close` restricted to Nova Operations (Program Coordinator, Nova Administrator); sensitive Serious/Emergency narrative detail may be further restricted to the optional Restricted Review Specialist where configured, applying the same "no detailed access without explicit restricted permission" pattern used for background data in `docs/architecture/authorization-rbac.md`. Participant access to incident detail is restricted by default under the general least-privilege posture (`docs/ops/data-governance.md`); this is not one of the items flagged Needs Validation in `docs/planning/assumptions.md`, so it follows the standard restricted-by-default rule rather than a special open question.

### Lifecycle rules
Incidents can be reported at any point while a placement is Onboarding, Active, or Paused, and reporting is not strictly gated to a single lifecycle state — safety and conduct issues are reported when they happen, including shortly after a placement ends. Reporting an incident does not itself transition placement lifecycle; a Serious or Emergency incident may prompt a coordinator to separately pause or terminate the placement (5.7/5.8) as a distinct, explicit action. The incident's own internal status (Open → Under Review → Closed) is independent of placement lifecycle and is never hard-deleted.

### Data changes
Adds `Incident` (`placementId`, category, severity, `reporterId`, description, restricted-detail fields, status, reviewer/closure fields, and a generated human-readable incident number per `docs/architecture/database-design.md`). Restricted fields are excluded from general-search indexing and from non-permitted role queries at the repository layer.

### UX and accessibility
Incident Form with the emergency-services notice visually and programmatically prominent — icon plus bold, always-visible text, never a dismissible tooltip and never color-only. Category and severity are accessible radio/select groups with clear labels; selecting Serious or Emergency triggers an additional confirmation step. The Incidents tab list uses text-and-icon severity badges, never color alone.

### Tests
- Unit: category/severity enum validation; restricted-field exclusion logic.
- Integration: Serious/Emergency triggers the urgent-alert surface; restricted content is excluded from general-search queries and from shelter/participant-scoped queries; hard-delete is prevented at the repository layer.
- Component: Incident Form including the emergency-services notice, severity-triggered confirmation, and shelter follow-up-only editing.
- E2E: a shelter user reports a Serious incident, Nova Operations sees it immediately in the urgent surface, reviews it, and closes it; a shelter user cannot alter category or severity after submission.

### Out of scope
Real-time SMS/email/push alerting (messaging is V2). Automatic placement pause or termination triggered by an incident — remains a manual, explicit coordinator decision via 5.7/5.8. Integration with actual emergency-service dispatch — explicitly not a substitute, and not built.

### Dependencies
5.1 (workspace tab). `docs/ops/incident-response.md` is authoritative for categories, severity, and ownership rules. `docs/architecture/security-privacy.md` for restricted classification. RULES.md's prohibition on treating form submission as emergency response.
