# Epic 3 — Enrollment and Training

## Goal

Prepare accepted participants for matching.

## Stories

| ID  | Story                                             | Status                |
| --- | ------------------------------------------------- | --------------------- |
| 3.1 | Create participant and enrollment transactionally | Done                  |
| 3.2 | Generate onboarding tasks                         | Done                  |
| 3.3 | Complete onboarding tasks                         | Done                  |
| 3.4 | Record training enrollment                        | Done                  |
| 3.5 | Record certifications                             | Done                  |
| 3.6 | Display matching blockers                         | Ready for Development |
| 3.7 | Mark participant ready for matching               | Ready for Development |

> Sequencing note: build order is 3.1 → 3.2 → 3.3 in strict sequence; 3.4 and 3.5 depend only on 3.1 and can proceed in parallel with 3.2/3.3. 3.6 depends on both onboarding (3.2/3.3) and training/certifications (3.4/3.5) because it aggregates all three sources, and 3.7 depends on 3.6's blocker policy as its server-side gate; see each story's Dependencies.

---

## Story 3.1 — Create participant and enrollment transactionally

### Status

Done

> Built note: MVP runs the single default Program (code `NOVA-TE`, seeded
> reference data); Cohort is deferred until a second program or cohort
> structure exists. The creation function is transaction-composable and
> invoked only inside 2.11's acceptApplication transaction.

### User story

As a Program Coordinator, I want accepting an application to atomically create the participant and Program Enrollment records, so that no accepted applicant is ever left in a half-created state and every acceptance immediately becomes a trackable enrollment.

### Scope

- Implement the enrollment-creation operation invoked from the Epic 2 acceptance workflow (Story 2.11) at the moment an application's decision is recorded as Accepted.
- In one database transaction: create or reuse the `Participant` record for the underlying `Person`, and create the `Program Enrollment` linking the Participant to the Program (and Cohort, if applicable).
- Reuse an existing `Participant` record if the accepted `Person` already has one (e.g., an alum reapplying), rather than creating a duplicate identity.
- Roll back the entire operation — leaving the application decision uncommitted — if any step fails.
- Emit a lifecycle event for the new Program Enrollment and an audit event for the acceptance-driven creation.
- Do not expose a standalone "create enrollment" action outside the acceptance workflow.

### Acceptance criteria

1. Given a Program Coordinator accepts an application, when the decision is recorded, then a `Participant` and a `Program Enrollment` are created in the same transaction as the acceptance.
2. Given any failure while creating the Participant or Program Enrollment, when the transaction is attempted, then the entire operation rolls back and no orphaned Participant or Enrollment is left behind.
3. Given a Person who already has a Participant record from a prior enrollment, when their new application is accepted, then the existing Participant is reused and a new Program Enrollment is created, rather than a duplicate Participant being created.
4. Given a successful creation, when it completes, then a lifecycle event is recorded for the Program Enrollment and an audit event is recorded for the acceptance.
5. Given the enrollment-creation operation, when invoked, then it is only reachable through the accepted-application code path — there is no route or action that creates a Program Enrollment independent of an Accepted application decision.

### Authorization

Not independently user-invoked. This operation executes inside the transaction and authorization boundary already established by Epic 2, Story 2.11 (Acceptance and rejection), which requires `application.decide` scoped to the Program Coordinator's organization. Story 3.1 must not introduce a separate endpoint or permission that allows Participant/Enrollment creation outside that flow.

### Lifecycle rules

Advances the participant's journey from Acceptance to Program Enrollment (`docs/product/participant-lifecycle.md`). Enrollment cannot become placement-active manually (`docs/product/business-rules.md`) — this story only ever produces a newly created enrollment; it never sets matching or placement state.

### Data changes

Creates `Participant` (linked to `Person` and the accepting `Application`) and `Program Enrollment` (linked to `Participant`, `Program`, optional `Cohort`). Writes one lifecycle event and one audit event. Uses a Prisma transaction per `RULES.md`.

### UX and accessibility

No dedicated screen — this is a server-side consequence of the Story 2.11 acceptance action. The existing acceptance confirmation UI should reflect that enrollment now exists (e.g., a success state naming the next step, "Onboarding"), consistent with the Enrollment workspace pattern in `docs/ux/wireframes-layouts.md`.

### Tests

- Unit: Participant reuse-vs-create decision logic; lifecycle/audit event payload shape.
- Integration: the full transaction commits atomically; a simulated failure mid-transaction leaves no Participant or Enrollment row.
- Component: not applicable (no new UI surface).
- E2E: coordinator accepts an application and the participant immediately appears in the enrollment/onboarding views with no manual follow-up step.

### Out of scope

The acceptance decision UI itself (Epic 2, Story 2.11), onboarding task generation (3.2), and any placement or matching state (Epics 4–5).

### Dependencies

Epic 2, Story 2.11 (Acceptance and rejection). Requires the `User`/`Membership`/authorization foundation from Epic 1.

---

## Story 3.2 — Generate onboarding tasks

### Status

Done

> Built note: generation runs inside the SAME transaction as 3.1's
> enrollment creation, so acceptance, enrollment, and the checklist exist
> together or not at all. The required-task catalog is seeded reference
> data (five `NOVA-TE` templates); `placementId` exists as a plain column
> under the XOR CHECK constraint until Epic 5's Placement model adds the
> relation.

### User story

As a Program Coordinator, I want the required onboarding tasks to be generated automatically as soon as a participant is enrolled, so that every participant starts onboarding with a complete, consistent checklist and nothing is missed.

### Scope

- On successful creation of a Program Enrollment (3.1), automatically generate one `Onboarding Task` instance per required task configured for the participant's Program, in a single transaction.
- Each generated task records: title, plain-language description, whether it is participant-completable or staff-only, required flag, and initial status of Not Started.
- Enforce the XOR ownership constraint on `Onboarding Task`: each task belongs to exactly one owning context — a Program Enrollment or a Placement — never both, never neither (the Placement-owned case is introduced later, in Epic 5, Story 5.4).
- Allow a Program Coordinator to view the generated task list for an enrollment (list view only; the completion action is 3.3).
- Guard against duplicate generation if the operation is retried (idempotent per enrollment).

### Acceptance criteria

1. Given a new Program Enrollment is created, when generation runs, then one Onboarding Task is created for each required task configured for that Program, each owned by that enrollment.
2. Given the required task set for a Program, when tasks are generated, then every task is created with status Not Started and the required/optional and participant-completable flags set correctly.
3. Given task generation is triggered twice for the same enrollment (e.g., a retried request), when it runs the second time, then no duplicate tasks are created.
4. Given a generated Onboarding Task, when its ownership is inspected, then it references exactly one owning context (its Program Enrollment), and the database rejects any attempt to set both an enrollment and a placement owner, or neither.
5. Given a Program Coordinator viewing an enrollment, when the onboarding task list loads, then it shows every generated task with its status.

### Authorization

Generation itself is system-triggered and requires no independent permission beyond the 3.1 chain. Viewing the list requires `onboardingTask.view` scoped to Nova Operations membership. Participant visibility is addressed in 3.3; shelters have no access to enrollment-stage onboarding data.

### Lifecycle rules

Represents the participant entering the Onboarding stage of `docs/product/participant-lifecycle.md`. The full required task set does not need to exist before other work proceeds, but the required subset gates 3.7.

### Data changes

Creates `Onboarding Task` rows owned by `Program Enrollment` via the XOR-constrained owning-context columns described in `docs/architecture/database-design.md`, inserted in one transaction so generation is all-or-nothing. Task template/required-set data is read, not written, by this story.

### UX and accessibility

Introduces the Task List component (`docs/ux/component-guidelines.md`) inside the Enrollment workspace's "Onboarding tasks" section (`docs/ux/wireframes-layouts.md`). Status is shown with text and icon together, never color alone; SVG icons only.

### Tests

- Unit: required-task-to-instance mapping; XOR owning-context validation logic.
- Integration: a database constraint rejects a task row with both or neither owning context set; repeated generation for one enrollment is idempotent.
- Component: the Task List renders generated tasks with accessible status indicators.
- E2E: after a coordinator accepts an application, the resulting enrollment shows a populated onboarding task list with no manual setup.

### Out of scope

Completing tasks (3.3), placement-owned onboarding tasks (Epic 5, Story 5.4), and building an administrative UI to author the required-task catalog (catalog is configured/seeded data for MVP).

### Dependencies

3.1 (Program Enrollment must exist). Shares the `Onboarding Task` model later reused by Epic 5, Story 5.4.

---

## Story 3.3 — Complete onboarding tasks

### Status

Done

> Built note: participant completion is ownership-based (Person →
> Participant → Enrollment chain), consistent with the applicant tier —
> the `onboardingTask.complete`/`.reopen` grants are the staff paths
> (PC/NA). Completion columns are working state; the correction history
> lives in the audit trail.

### User story

As a participant, I want to complete my onboarding tasks and see my progress, so that I always know what I still need to do before I can be matched to a placement.

### Scope

- Provide a participant-facing action to mark a participant-completable Onboarding Task complete (e.g., acknowledge a document, confirm profile information).
- Provide a Program Coordinator action to mark any required onboarding task complete, including staff-only tasks (e.g., "verify identity documents," "conduct orientation call"), and to reopen a task if it was completed in error.
- Record who completed each task and when.
- Reflect live progress (complete / remaining count) on both the participant dashboard and the Operations Enrollment workspace.
- Enforce that only participant-completable tasks are completable by the participant; staff-only tasks show as pending with respectful copy, not a broken or missing action.

### Acceptance criteria

1. Given a participant-completable task that is Not Started, when the participant completes it, then its status becomes Complete and records the participant as the completer and a timestamp.
2. Given a staff-only task, when a participant views their task list, then they see it listed as pending with no completion control, and plain-language copy explaining Nova staff will handle it.
3. Given any required task, when a Program Coordinator completes it on the participant's behalf, then its status becomes Complete and records the coordinator and a timestamp.
4. Given a task that was completed in error, when a Program Coordinator reopens it, then its status returns to Not Started, the correction is captured in the audit trail, and the task reappears as an outstanding item.
5. Given a participant attempts to complete a task that does not belong to their own enrollment, when the action runs, then it is denied server-side regardless of client state.

### Authorization

Participant completion requires `onboardingTask.complete` scoped to the authenticated user's own linked Participant/Program Enrollment, and only for tasks flagged participant-completable. Coordinator completion and reopening require `onboardingTask.complete` and `onboardingTask.reopen` respectively, scoped to Nova Operations membership. Lifecycle state must be Not Started or Complete as appropriate to the action — no completing an already-complete task, no reopening a Not Started task.

### Lifecycle rules

Task completion does not itself change the enrollment's lifecycle stage; it narrows the set of outstanding blockers evaluated in 3.6. All status changes are recorded, never overwritten in place, preserving lifecycle history per `RULES.md`.

### Data changes

Updates `Onboarding Task` status, completedBy, and completedAt fields; writes an audit event for coordinator completions and reopenings (sensitive/corrective actions).

### UX and accessibility

Task List and Status Transition Control components (`docs/ux/component-guidelines.md`); the participant dashboard's Next Step / Required tasks card (`docs/ux/wireframes-layouts.md`) reflects remaining tasks in plain, respectful language (`docs/ux/content-style-guide.md`) — never "failed" or judgmental phrasing. Completion controls are keyboard-operable with visible focus and an accessible label naming the specific task, not a bare "Complete" button.

### Tests

- Unit: completion eligibility rules (participant-completable vs. staff-only); reopen transition rules.
- Integration: cross-enrollment completion attempts are denied at the data layer; audit events are written for coordinator actions.
- Component: task list shows correct controls per role and per task type; reopened tasks reflect updated state accessibly.
- E2E: a participant completes their own tasks end to end; a coordinator completes a staff-only task and reopens a mistaken completion.

### Out of scope

Task generation (3.2), training/certification tracking (3.4, 3.5), and the aggregated blocker view (3.6).

### Dependencies

3.2 (tasks must exist). Requires participant identity linkage and role-specific layouts from Epic 1, Story 1.7.

---

## Story 3.4 — Record training enrollment

### Status

Done

> Policy decision: `ADR-017` adopts three required, program-scoped portable Training Programs and an independent host-site onboarding/competency layer. Story 3.4 implements only the portable layer; Story 5.4 owns the site layer.
>
> Built note: `NOVA-TE` seeds the three required catalog programs. Coordinator-only Enroll, Start, Complete, and Withdraw actions enforce the ADR-017 lifecycle, structured completion evidence, append-only events, audit events, date/status database checks, and one-active-attempt uniqueness. Operations receives the full training workspace; participants receive only the rolled-up Onboarding → Training → Training complete journey state.

### User story

As a Program Coordinator, I want to record which Training Program a participant is enrolled in and track their progress, so that training completion is visible and feeds matching readiness.

### Scope

- Allow a Program Coordinator to enroll a participant in one or more `Training Program`s, creating a `Training Enrollment` record.
- Seed the three `ADR-017` required Training Programs for `NOVA-TE`; requiredness belongs to the Program-scoped catalog so a missing enrollment can be detected.
- Track `ENROLLED`, `IN_PROGRESS`, `COMPLETED`, and `WITHDRAWN` with their corresponding dates.
- Expose explicit Enroll, Start, Complete, and Withdraw actions following `ADR-017`; never an arbitrary status dropdown.
- Require a structured completion-evidence method and record the verifier and timestamp. Attendance alone is not sufficient.
- Preserve terminal attempts and allow later re-enrollment as a new attempt; prevent more than one active attempt for the same enrollment/program.
- Feed completed Training Enrollments into the compatibility engine's readiness inputs (`docs/product/compatibility-engine.md`).
- Surface Training as the participant's current journey step (Journey Timeline) once onboarding is complete, without building a dedicated participant training-management page (not part of `docs/ux/information-architecture.md` for Participant).

### Acceptance criteria

1. Given a Program Coordinator selects a Training Program for a participant, when they record the enrollment, then a Training Enrollment is created linking the participant, the Training Program, and the enrollment date.
2. Given a Training Enrollment, when an explicit valid transition is performed, then the status and effective date update transactionally and an append-only event preserves the change; an invalid or repeated transition is rejected.
3. Given a participant with at least one required Training Program not yet completed, when matching readiness is evaluated (3.6), then that training appears as an outstanding item.
4. Given all required Training Enrollments for a participant reach Completed, when the Journey Timeline is viewed, then Training is no longer shown as the outstanding step.
5. Given a participant views their own dashboard, when it renders, then their current step reflects Training when onboarding is complete but required training is not, without exposing internal coordinator-only detail.
6. Given a coordinator completes a Training Enrollment, when the action runs, then exactly one approved evidence method is required and the verifier/time are recorded; completion is not represented as host-site task proficiency.
7. Given a completed or withdrawn attempt, when the participant later re-enrolls in the same Training Program, then a new attempt is created and prior history remains unchanged; a second simultaneous active attempt is rejected.

### Authorization

Create/update requires `trainingEnrollment.create` / `trainingEnrollment.update` scoped to active Nova Operations membership. Participants have no direct write access; their visibility is limited to the rolled-up journey step. Shelters have no Epic 3 training access.

### Lifecycle rules

Represents the portable Training stage in `docs/product/participant-lifecycle.md`. The exact lifecycle is defined by `ADR-017`; Completed and Withdrawn are terminal attempts. Completion does not satisfy the Placement-owned site gate.

### Data changes

Creates program-scoped `Training Program` catalog rows, `Training Enrollment` attempts linked to `Program Enrollment`, and append-only `Training Enrollment Event` rows. Stores structured completion method and verifier metadata. A database constraint prevents multiple active attempts for the same enrollment/program.

### UX and accessibility

Training list/detail lives in the Operations Enrollment workspace ("Training" section per `docs/ux/wireframes-layouts.md`). Status uses text plus icon, never color alone. Participant-facing reflection is limited to the existing Journey Timeline / Next Step card.

### Tests

- Unit: exhaustive status-transition rules, evidence requirement, and readiness-input mapping.
- Integration: transitions and events are atomic; terminal attempts/history are preserved; active-attempt uniqueness and organization/role scoping are enforced.
- Component: coordinator training list renders statuses accessibly.
- E2E: coordinator records and completes a training enrollment; participant's journey step updates accordingly.

### Out of scope

Certification records (3.5), a dedicated participant-facing training page, catalog-authoring UI, and host-site orientation/competency records (5.4).

### Dependencies

3.1 (Program Enrollment must exist). Feeds 3.6 (matching blockers).

---

## Story 3.5 — Record certifications

### Status

Done

> Built note: per ADR-017, certifications default to NOT required for
> matching (credentials gate task eligibility). A coordinator may mark one
> required; 3.6 then treats an EXPIRED required certification as an
> outstanding blocker. A certification that was never recorded is not a
> blocker. This story also performed the planned Document XOR expansion:
> Application XOR Certification owning contexts, enforced by a Postgres
> CHECK constraint.

### User story

As a Program Coordinator, I want to record a participant's certifications, so that completed credentials are tracked, feed matching readiness, and are visible to the participant.

### Scope

- Allow a Program Coordinator to create and edit a `Certification` record for a participant: type/name, issuer, issue date, expiration date (if applicable), and status.
- Optionally attach a supporting document to a Certification through the existing `Document` entity/upload workflow established in Epic 2, Story 2.4, respecting the one-owning-context-per-document rule.
- Feed required, unexpired certifications into the compatibility engine's readiness inputs (`docs/product/compatibility-engine.md`).
- Provide a participant-facing, read-only "Certifications" view listing their own certifications (`docs/ux/information-architecture.md` — Participant › Certifications), consistent with the PRD's "View certifications" capability.

### Acceptance criteria

1. Given a Program Coordinator records a certification for a participant, when saved, then a Certification record is created with issuer, dates, and status, linked to that participant.
2. Given a certification with an expiration date that has passed, when matching readiness is evaluated (3.6), then a required certification in that state is treated as an outstanding item, not as satisfied.
3. Given a coordinator attaches a document to a certification, when saved, then the document's owning context is the certification alone — the same document row cannot also be owned by an application or another context.
4. Given a participant opens their Certifications view, when it loads, then they see only their own certifications, in plain language, with no coordinator-only detail (e.g., no internal notes).
5. Given a certification record, when edited (e.g., correcting a date), then the change is saved and prior values remain part of the record's history rather than being silently lost.

### Authorization

Create/update requires `certification.record` scoped to Nova Operations membership. Participant read access requires `certification.view` scoped to the authenticated user's own linked Participant record only. Shelters have no access to certification records in Epic 3 (pre-placement).

### Lifecycle rules

Certification completion is one of the readiness inputs gating the Training stage of `docs/product/participant-lifecycle.md`. An expired certification can turn a previously satisfied requirement back into a blocker; this story only records state — the recomputation happens in 3.6.

### Data changes

Creates/updates `Certification` (linked to `Participant`); optionally links a `Document` via its single owning-context reference. No hard deletes — corrections are edits with preserved history, per `RULES.md`.

### UX and accessibility

Operations: certification entry lives in the Enrollment workspace ("Training" section groups training and certifications per `docs/ux/wireframes-layouts.md`). Participant: a dedicated Certifications page per `docs/ux/information-architecture.md`, read-only, plain language, accessible list semantics, status conveyed with text and icon.

### Tests

- Unit: expiration-status calculation; document single-owning-context validation.
- Integration: the database rejects a document linked to more than one owning context; participant queries never return other participants' certifications.
- Component: participant Certifications view renders accessibly with correct status text/icons.
- E2E: coordinator records a certification with an attached document; participant sees it on their Certifications page; an expired required certification reappears as a blocker.

### Out of scope

Training enrollment tracking (3.4, though related), automatic certification issuance from training completion, and any shelter-facing certification view (later epic, if ever).

### Dependencies

3.1 (Participant must exist). Optional document attachment depends on the Document upload capability from Epic 2, Story 2.4. Feeds 3.6.

---

## Story 3.6 — Display matching blockers

### Status

Done

> Built note: the shared policy is `computeMatchingReadiness`
> (src/server/domain/matching-readiness.ts) — pure, evaluated live on every
> call, and reused verbatim as 3.7's gate. The coordinator surface uses the
> enrollment workspace's established access gate (`application.view` +
> Nova scope, per 3.2's convention) rather than a new `enrollment.view`
> permission. Per ADR-017/3.5, a certification that was never recorded is
> not a blocker; an EXPIRED required one is.

### User story

As a Program Coordinator, I want to see exactly what is blocking a participant from being ready for matching, so that I can help them finish the right requirements without guessing.

### Scope

- Implement a shared matching-readiness policy that evaluates a Program Enrollment against required onboarding tasks (3.2/3.3), required Training Enrollments (3.4), and required, unexpired Certifications (3.5).
- Return a structured list of outstanding blockers (what is missing, and which required item it maps to), plus an overall ready/not-ready result.
- Render the coordinator-facing Blocker List in the Enrollment workspace (`docs/ux/wireframes-layouts.md`), with a link/action to the specific outstanding task, training, or certification.
- Render a plain-language, respectful version of the same information on the participant dashboard's Next Step / Required tasks card (`docs/ux/wireframes-layouts.md`), without internal codes or coordinator-only detail.
- Recompute on demand (not cached stale) so the list reflects the latest completions and any newly expired certification.

### Acceptance criteria

1. Given a Program Enrollment with incomplete required onboarding tasks, when the blocker list is computed, then each incomplete required task appears as a blocker.
2. Given a Program Enrollment with an incomplete required Training Enrollment or an expired required Certification, when the blocker list is computed, then each one appears as a blocker.
3. Given a Program Enrollment with every required onboarding task, training, and certification satisfied, when the blocker list is computed, then it is empty and the enrollment evaluates as ready.
4. Given a Program Coordinator viewing the Enrollment workspace, when blockers exist, then the Blocker List shows each one with enough detail to act on it (which task, training, or certification, and a way to navigate to it).
5. Given a participant viewing their dashboard, when blockers exist, then they see a respectful, plain-language list of what they still need to do, with no internal jargon, coordinator notes, or color-only status indicators.

### Authorization

Coordinator view requires `enrollment.view` scoped to Nova Operations membership. Participant view requires the enrollment to belong to the authenticated user's own linked Participant record. The underlying policy function performs no writes and requires no permission of its own, but every caller (coordinator UI, participant UI, and the 3.7 gate) enforces its own scope check server-side.

### Lifecycle rules

This story only reads state; it does not transition the enrollment. It defines the exact gate that 3.7 subsequently enforces, keeping the Training → Ready for Matching boundary in `docs/product/participant-lifecycle.md` consistent between what is displayed and what is enforced.

### Data changes

None. Read-only aggregation across `Onboarding Task`, `Training Enrollment`, and `Certification`.

### UX and accessibility

Blocker List component (`docs/ux/component-guidelines.md`, `docs/ux/wireframe-spec.md`) with text-plus-icon status, not color alone. Empty state ("No outstanding requirements") is explicit, not a blank panel. Coordinator and participant views share the same underlying computation but distinct, role-shaped copy per `docs/ux/content-style-guide.md`.

### Tests

- Unit: the blocker-computation policy against combinations of complete/incomplete tasks, training, and certifications, including expired certifications.
- Integration: the policy reflects live database state (no stale cache) across the three source tables.
- Component: Blocker List and the participant Required tasks card render correct items accessibly, including the empty/ready state.
- E2E: a coordinator watches a participant's blocker list shrink to empty as tasks, training, and certifications are completed.

### Out of scope

The actual Ready for Matching transition (3.7) and the Epic 4 matching queue that consumes ready participants.

### Dependencies

3.2/3.3 (onboarding tasks) and 3.4/3.5 (training and certifications). Its policy function is reused by 3.7.

---

## Story 3.7 — Mark participant ready for matching

### Status

Done

> Built note: the transition re-runs `computeMatchingReadiness` INSIDE the
> transaction (all four source reads through the transaction client), so
> the gate that is displayed (3.6) is byte-for-byte the gate that is
> enforced, evaluated on live rows at commit time. Rejections name the
> specific remaining blockers. Epic 4 consumes READY_FOR_MATCHING
> enrollments directly; no Placement objects are created here (ADR-002).

### User story

As a Program Coordinator, I want to mark a participant ready for matching once every requirement is met, so that they become visible to the matching process and no one is matched before they are actually prepared.

### Scope

- Provide a Program Coordinator action that transitions a Program Enrollment to Ready for Matching.
- Re-evaluate the 3.6 blocker policy server-side at the moment of transition and reject the transition if any blocker remains, even if the client believes it is clear.
- Record a lifecycle event and an audit event for the transition, including who performed it and when.
- Make Ready for Matching participants visible to the Epic 4 matching queue (data-level readiness only; the queue UI itself is Epic 4, Story 4.1).
- Update the participant's Journey Timeline to show Ready for Matching as the current step.

### Acceptance criteria

1. Given a Program Enrollment with no outstanding blockers, when a Program Coordinator marks it ready for matching, then its state becomes Ready for Matching and a lifecycle event and audit event are recorded.
2. Given a Program Enrollment with at least one outstanding blocker, when a Program Coordinator attempts the transition, then it is rejected server-side with the specific remaining blockers named, even if the request bypasses the UI.
3. Given an enrollment already marked Ready for Matching, when the action is attempted again, then it is rejected as a no-op/conflict rather than silently duplicating the transition.
4. Given a participant whose enrollment becomes Ready for Matching, when they view their dashboard, then their Journey Timeline reflects Ready for Matching as the current step, in plain language.
5. Given a user without the required permission attempts the transition, when the request is made directly (e.g., bypassing the UI button), then it is denied server-side.

### Authorization

Requires `enrollment.markReadyForMatching` scoped to Nova Operations membership. Lifecycle state must be the pre-Ready-for-Matching enrollment state; the transition is denied outside that state, per the Authorization = Permission + Resource Scope + Lifecycle State model in `docs/architecture/authorization-rbac.md`.

### Lifecycle rules

Implements the Training → Ready for Matching transition in `docs/product/participant-lifecycle.md`. This is an action-based, gated transition, not a free status edit (`RULES.md`: no arbitrary lifecycle status dropdowns). Reaching Ready for Matching does not create a Placement Match or Placement and does not make the enrollment placement-active — those remain separate lifecycle objects per `docs/decisions/ADR-002-separate-lifecycles.md` and are handled starting in Epic 4.

### Data changes

Updates the Program Enrollment's lifecycle state to Ready for Matching inside a transaction; writes one lifecycle event and one audit event. No other tables change.

### UX and accessibility

Status Transition Control component (`docs/ux/component-guidelines.md`) in the Enrollment workspace, disabled (not hidden) with a text explanation when blockers remain, so coordinators understand why rather than guessing. Journey Timeline update follows the existing accessible transition-announcement pattern (`docs/ux/accessibility.md` — screen-reader transition announcements).

### Tests

- Unit: transition guard re-checks the 3.6 policy; idempotency/conflict handling for a repeated transition.
- Integration: the transition is atomic and writes exactly one lifecycle event and one audit event; a direct service call with remaining blockers is rejected.
- Component: the Status Transition Control is disabled with an explanation when blockers exist, and enabled when clear.
- E2E: a coordinator clears all blockers and marks a participant ready for matching; the participant sees the updated journey step; a bypass attempt with remaining blockers is denied.

### Out of scope

The Epic 4 matching queue and any subsequent match/placement workflow. Reverting a participant from Ready for Matching back to Training (e.g., if a certification later expires) is not handled by this story; this gap should be revisited when that scenario is prioritized.

### Dependencies

3.6 (blocker policy). Enables Epic 4, Story 4.1 (Matching queue).
