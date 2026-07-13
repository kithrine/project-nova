# Epic 4 — Placement Matching

## Goal
Create safe, approved participant-to-shelter matches.

## Stories

| ID | Story | Status |
|---|---|---|
| 4.1 | Matching queue | Done |
| 4.2 | Compatibility panel | Done |
| 4.3 | Create match draft | Ready for Development |
| 4.4 | Propose match | Ready for Development |
| 4.5 | Record participant decision | Ready for Development |
| 4.6 | Record shelter decision | Ready for Development |
| 4.7 | Request changes | Ready for Development |
| 4.8 | Approve match and create placement | Ready for Development |

> Sequencing note: build the `PlacementMatch` schema in 4.3 first, or alongside 4.1 — the matching queue (4.1) needs it to exclude participants who already have a non-terminal match, while the compatibility panel (4.2) can be built against enrollment/training/shelter data independently of it. 4.5 and 4.6 are independent decision tracks that may be built in either order once 4.4 exists; both feed the single human approval gate in 4.8.

---

## Story 4.1 — Matching queue

### Status
Done

> Built note: per the epic sequencing note, the `PlacementMatch` schema
> (model, MatchStatus/decision enums, and the one-non-terminal-match
> partial unique index) shipped alongside this story so the exclusion rule
> is real from day one; Story 4.3 owns the service/UI on top of it.
> `OrganizationSite.capacity` was added per shelter-onboarding system
> setup. Placement-based exclusion (AC3) is wired in the domain rule and
> activates when the Placement model lands (4.8/Epic 5).

### User story
As a Program Coordinator, I want a queue of participants who are ready for matching alongside shelters with available capacity, so that I can identify and prioritize safe, viable candidate pairings.

### Scope
- Build an Operations queue view, reached from the `(operations)` route group's Placements area (`docs/ux/information-architecture.md` has no separate "Matching" nav item; the queue is a worklist within Placements, consistent with the Operations dashboard's queue-and-blocker pattern in `docs/ux/wireframes-layouts.md`).
- List participants whose Program Enrollment was marked Ready for Matching (Epic 3, Story 3.7) and who have no non-terminal `PlacementMatch` (Draft, Proposed, or Change Requested) and no onboarding/active/paused Placement.
- Surface each candidate's readiness date, program/cohort, availability, and any matching blockers carried over from Epic 3, Story 3.6.
- List host organizations and sites with available capacity (`docs/ops/shelter-onboarding.md` capacity data) alongside or filterable against the participant list.
- Provide sorting/filtering (for example, longest-waiting first, by shelter, by site) as a coordinator worklist, not a public listing.
- Selecting a participant and a candidate shelter/site is the entry point into the Compatibility Panel (4.2) and, from there, into a match draft (4.3).

### Acceptance criteria
1. Given a participant marked Ready for Matching with no non-terminal match and no onboarding/active/paused placement, when the coordinator opens the matching queue, then the participant appears as an awaiting-match candidate.
2. Given a participant with an existing Draft, Proposed, or Change Requested match, when the queue loads, then that participant is shown as in progress rather than duplicated as awaiting-match, so the coordinator cannot accidentally start a second match for them.
3. Given a participant with an onboarding, active, or paused placement, when the queue loads, then that participant does not appear as an unmatched candidate (`docs/product/business-rules.md`: one onboarding/active/paused placement at a time).
4. Given host organizations and sites with available capacity, when the queue loads, then they are visible as candidate hosts alongside or filterable against the participant list.
5. Given the coordinator selects a candidate participant and shelter, when they choose to review the pairing, then they are taken to the Match Compatibility Panel (4.2) for that specific pair.
6. Given a user who is not a Program Coordinator or Nova Administrator (a Shelter Manager, Shelter Supervisor, or Participant), when they request the matching queue route, then access is denied.

### Authorization
Requires `placementMatch.viewQueue`, held by Program Coordinator and Nova Administrator, scoped to the Nova organization (the queue spans all shelters, unlike shelter-scoped views elsewhere in the product). The queue itself has no lifecycle gate; its rows are filtered by the lifecycle state of other resources (enrollment readiness, match status, placement status).

### Lifecycle rules
None owned by this story. The queue reads lifecycle state from Program Enrollment (ready-for-matching), `PlacementMatch` (non-terminal statuses, once 4.3 exists), and Placement (onboarding/active/paused) to compute inclusion — it does not transition anything itself.

### Data changes
None new. Reads existing `Participant`, `ProgramEnrollment`, `Organization`, and `OrganizationSite` data; once 4.3 lands, the exclusion query also reads `PlacementMatch`.

### UX and accessibility
- Operations-dashboard-style worklist: dense table on desktop, stacked cards on mobile, consistent with the mobile-first baseline that keeps Operations desktop-optimized for density (`docs/ux/wireframe-spec.md`).
- Empty state when no participants are ready or no shelters have capacity, per the required screen states in `docs/ux/wireframe-spec.md`.
- "In progress" vs. "awaiting match" is shown with text and an icon, never color alone.
- Keyboard-navigable row selection and an accessible label identifying each participant/shelter pairing action.

### Tests
- Unit: queue inclusion/exclusion rule (ready-for-matching, non-terminal match, conflicting placement).
- Integration: query correctness against fixtures combining ready, already-matched, and already-placed participants; organization-scope is not applicable here but permission scope is enforced.
- Component: queue list, empty state, and in-progress badge render with accessible text+icon status.
- E2E: a Program Coordinator reaches the queue and opens a candidate; a Shelter Manager and a Participant are denied the route.

### Out of scope
Compatibility scoring itself (4.2), draft creation (4.3), and shelter capacity management or editing (`docs/ops/shelter-onboarding.md` system setup, owned by shelter onboarding operations, not this epic).

### Dependencies
Epic 3, Stories 3.6 (matching blockers) and 3.7 (ready for matching); Story 1.5 (authorization context); Story 1.7 (Operations protected layout). Full exclusion of already-drafted participants depends on 4.3's schema — see the sequencing note above.

---

## Story 4.2 — Compatibility panel

### Status
Done

> Built note: the evaluator is pure (src/server/domain/compatibility.ts):
> factor list -> worst-of category (blocking > unknown > concern > clear),
> so "Unknown / needs review" is the honest pairing-stage answer while
> schedule/dates live only on a draft (4.3 wires them, plus the snapshot).
> The approved-placement-restriction store does not exist yet; the input is
> wired false and the fixed-sentence factor (never a narrative) activates
> when that workflow lands. No numeric score exists anywhere in the domain,
> payload, or panel (ADR-011) — asserted at every test layer.

### User story
As a Program Coordinator, I want an explainable, categorical compatibility read on a candidate participant-shelter pairing, so that I can make an informed, safe matching decision without relying on an opaque score.

### Scope
- Implement server-side compatibility evaluation per `docs/product/compatibility-engine.md`, combining: participant availability, required certifications, training completion, shelter capacity, site and supervisor availability, proposed schedule, transportation feasibility, placement start/end dates, and any approved placement restrictions.
- Produce one of exactly four categorical results — Compatible, Potential concern, Blocking incompatibility, or Unknown / needs review — never a numeric or opaque score (`docs/decisions/ADR-011-manual-matching.md`).
- Render each result with the specific factor(s) behind it (for example, "Certification: complete," "Schedule: 2 of 5 shifts overlap") so the read is explainable, not a black box.
- When an approved placement restriction applies, reflect that a restriction affects the read without displaying the restricted background narrative itself — the underlying content stays behind restricted permission, outside this panel.
- Build the panel as the Match Compatibility Panel component (`docs/ux/component-guidelines.md`), invoked from the matching queue (4.1) and, once a draft exists, from the draft itself (4.3).
- The panel is advisory and coordinator-facing only; it never appears in the shelter or participant experience, and it never decides anything on its own.

### Acceptance criteria
1. Given a pairing where availability, certifications, training, capacity, schedule, transportation, and dates all clear, when the panel evaluates them, then it displays "Compatible" with the supporting factors listed.
2. Given a pairing with a non-blocking issue (for example, partial schedule overlap), when evaluated, then the panel displays "Potential concern" and names the specific factor.
3. Given a pairing with a hard-blocking issue (for example, a missing required certification or no shelter capacity), when evaluated, then the panel displays "Blocking incompatibility" and names the blocking factor(s).
4. Given a pairing where a required input cannot be determined (for example, training status not yet recorded), when evaluated, then the panel displays "Unknown / needs review" rather than guessing at a result.
5. Given a pairing where the participant has an approved placement restriction on file, when evaluated, then the result reflects that a restriction applies without rendering the restricted background narrative.
6. Given any result, when rendered, then it is shown with both text and an SVG icon, never color alone, and no numeric score is displayed anywhere on the panel.

### Authorization
Requires `placementMatch.viewCompatibility`, held by Program Coordinator and Nova Administrator only. Shelter and Participant roles cannot load this panel under any permission (`docs/product/compatibility-engine.md`: restricted background information is never displayed to shelters, and the categorical read itself is coordinator decision support, not a shelter-facing artifact). Viewing the restricted narrative behind a placement restriction, if ever needed, requires a separate restricted permission (see the optional Restricted Review Specialist role in `docs/architecture/authorization-rbac.md`) and is out of scope for this panel.

### Lifecycle rules
Advisory only — evaluating compatibility never changes the lifecycle state of the participant, enrollment, or any match. It can run against a candidate pairing before a Draft exists (4.1) and again against a specific Draft or Proposed match (4.3, 4.7) as details change.

### Data changes
None persisted by this story. The evaluation is derived live from existing `Participant`, `ProgramEnrollment`, `TrainingEnrollment`, `Certification`, `Organization`, and `OrganizationSite` data, plus `PlacementMatch` once 4.3 exists, so the same inputs always reproduce the same explainable result. Story 4.3 may persist a point-in-time snapshot of a given result on the draft for later reference — that snapshot field is introduced there, not here.

### UX and accessibility
- Match Compatibility Panel component (`docs/ux/component-guidelines.md`) with text+icon category badges and a plain-language factor list underneath.
- Loading, empty (no pairing selected), and "Unknown / needs review" states are distinct and follow `docs/ux/wireframe-spec.md`'s required screen states.
- Mobile-first layout that collapses the factor list under the category badge on small screens; Operations remains desktop-optimized for density above that baseline.
- Plain, specific factor labels, not internal jargon or raw field names (`docs/ux/content-style-guide.md`).

### Tests
- Unit: categorization rules for every input combination (compatible / concern / blocking / unknown) and the restriction-handling rule that never surfaces the restricted narrative.
- Integration: evaluation reads real participant/enrollment/training/certification/organization data and produces the correct category and factor list.
- Component: panel renders each of the four categories with text+icon (never color-only) and renders the factor explanations; restricted-restriction case renders without the narrative.
- E2E: a coordinator opens the panel from the queue and sees a categorical, explainable result for a real candidate pairing.

### Out of scope
Automated or AI-driven matching or ranking (`docs/decisions/ADR-011-manual-matching.md`), any numeric scoring, shelter- or participant-facing display of this panel, and permanent persistence of every evaluation (only an optional snapshot at draft-creation time, built in 4.3).

### Dependencies
Story 4.1 (entry point); Epic 3 (training, certification, and onboarding data); `docs/ops/shelter-onboarding.md` (capacity data); Story 1.5 (authorization context).

---

## Story 4.3 — Create match draft

### Status
Ready for Development

### User story
As a Program Coordinator, I want to create a Draft placement match with the proposed participant, host, and arrangement details, so that I can assemble a candidate placement before presenting it to anyone else.

### Scope
- Introduce the `PlacementMatch` Prisma model and its `MatchStatus` enum (`DRAFT`, `PROPOSED`, `APPROVED`, `CHANGE_REQUESTED`, `DECLINED`, `WITHDRAWN`, `EXPIRED`), plus the two independent decision enums — `ParticipantMatchDecision` (`PENDING`, `ACCEPTED`, `DECLINED`) and `ShelterMatchDecision` (`PENDING`, `APPROVED`, `CHANGE_REQUESTED`, `DECLINED`) — per `docs/product/placement-lifecycle.md`.
- From a queue selection (4.1), let the coordinator create a match: participant, program enrollment, host organization, site, a candidate supervisor, a candidate schedule summary, candidate start/end dates, a candidate funding source reference, and internal coordinator notes.
- Persist an optional snapshot of the 4.2 compatibility result at creation time (and on later re-evaluation) so the rationale for the pairing survives as a point-in-time record.
- Allow the coordinator to edit site, supervisor, schedule, dates, and notes while the match is in Draft, and to re-run the compatibility panel against the edited details.
- Allow the coordinator to withdraw a Draft they no longer want to pursue.
- Drafts are coordinator-internal: never visible to the participant or the shelter.

### Acceptance criteria
1. Given a participant and a host organization/site selected from the queue, when the coordinator creates a match, then a `PlacementMatch` is created in Draft status with both decision tracks not yet applicable.
2. Given a participant who already has a non-terminal match (Draft, Proposed, or Change Requested) or an onboarding/active/paused placement, when the coordinator attempts to create a new draft for them, then creation is blocked with a clear reason referencing the one-placement-at-a-time rule.
3. Given a Draft match, when the coordinator edits site, supervisor, schedule, or dates, then the changes save and the match remains in Draft status.
4. Given a Draft match, when the coordinator views it, then the most recent compatibility snapshot is shown alongside the draft details.
5. Given a Draft match the coordinator no longer wants to pursue, when they withdraw it, then it transitions to Withdrawn (terminal) and drops out of the active worklist.
6. Given a Participant or a Shelter Manager/Supervisor, when they attempt to view or access a Draft match, then access is denied — Drafts are coordinator-only regardless of organization scope.

### Authorization
Requires `placementMatch.manageDraft` (create, edit, and withdraw while Draft), held by Program Coordinator and Nova Administrator, scoped to the Nova organization. Visibility is additionally lifecycle-gated: a match in Draft status is never returned to Participant or Shelter roles, independent of any other permission they might hold on later-stage matches.

### Lifecycle rules
Creates the match in Draft. Draft → Withdrawn is a direct, explicit coordinator action (terminal). Draft → Proposed happens only through 4.4. Creation enforces "no conflicting active placement" and "no duplicate non-terminal match per participant" as prerequisites (`docs/product/business-rules.md`, `docs/product/placement-lifecycle.md` activation prerequisites).

### Data changes
Adds `PlacementMatch` (`participantId`, `programEnrollmentId`, `hostOrganizationId`, `organizationSiteId`, `proposedSupervisorId`, `proposedSchedule`, `proposedStartDate`, `proposedEndDate`, `candidateFundingSourceId`, `status`, `participantDecision`, `shelterDecision`, `compatibilitySnapshot`, `coordinatorNotes`, timestamps) and the `MatchStatus`, `ParticipantMatchDecision`, and `ShelterMatchDecision` enums in `SCREAMING_SNAKE_CASE`. Enforces "no more than one non-terminal match per participant" as a database constraint, mirroring the partial-unique-index pattern `docs/architecture/database-design.md` uses for active placements. Writes a lifecycle event on creation and on withdrawal.

### UX and accessibility
- Draft is built in an Operations form/workspace (the full Placement Workspace does not exist until 4.8/Epic 5); reuses Form Field, Select, and Date/Time Input primitives from `docs/ux/component-guidelines.md`.
- Accessible labels above inputs, programmatically associated inline validation errors, and a visible focus order that follows the form's logical sequence.
- The Blocked screen state (`docs/ux/wireframe-spec.md`) renders when creation is blocked by a conflicting match or placement, naming the conflict in plain language.
- Mobile-first form baseline within the desktop-optimized Operations shell.

### Tests
- Unit: draft-creation prerequisite checks (no duplicate non-terminal match, no conflicting placement) and the Draft → Withdrawn transition.
- Integration: a Prisma transaction creates the `PlacementMatch` plus its lifecycle event; the uniqueness constraint rejects a second non-terminal match for the same participant.
- Component: draft form validation, the Blocked state, and the compatibility-snapshot display.
- E2E: a coordinator creates a draft from the queue and sees it in their worklist; a second attempt for the same participant is blocked.

### Out of scope
Proposing the match to the participant and shelter (4.4), either decision track (4.5, 4.6), and placement creation (4.8).

### Dependencies
Story 4.1 (queue entry point); Story 4.2 (compatibility snapshot); Epic 3 (enrollment, training, and certification data); `docs/ops/shelter-onboarding.md` (site, supervisor, and capacity data); Story 1.5.

---

## Story 4.4 — Propose match

### Status
Ready for Development

### User story
As a Program Coordinator, I want to propose a Draft match to both the participant and the shelter, so that each party can review the arrangement and record their own decision.

### Scope
- Transition a Draft match to Proposed, setting both `participantDecision` and `shelterDecision` to Pending.
- Require the core fields (participant, host, site, candidate supervisor, candidate schedule, candidate dates) to be present before a match can be proposed.
- Make the Proposed match visible to the participant via the Proposed Placement Card on their dashboard/My Placement area, and to the shelter via the Shelter dashboard's Placement approvals (`docs/ux/wireframes-layouts.md`, `docs/ux/component-guidelines.md`).
- Set a decision-window/expiration target on proposal; a Proposed match that receives no decision from either party within that window is eligible to be marked Expired by a time-based check (scheduled or evaluated on access).
- Return the same underlying record as distinct, role-shaped view models — never a raw Prisma record — so the participant's view and the shelter's view each omit the other party's internal notes and any coordinator-internal notes.

### Acceptance criteria
1. Given a Draft match with all required fields present, when the coordinator proposes it, then the match transitions to Proposed and both `participantDecision` and `shelterDecision` are set to Pending.
2. Given a Draft match missing a required field, when the coordinator attempts to propose it, then the action is blocked and the missing fields are identified.
3. Given a Proposed match, when the participant views their dashboard, then they see the Proposed Placement Card with plain-language details (host, role, schedule, location) and no restricted background content.
4. Given a Proposed match, when the shelter (Shelter Manager or Shelter Supervisor) views their dashboard, then they see it under Placement approvals with the equivalent non-restricted details.
5. Given a Proposed match that exceeds the decision window with no decision recorded on either track, when the expiration check runs, then it transitions to Expired and drops out of both parties' active worklists.
6. Given a user outside the match's organization scope (for example, a different shelter's Shelter Manager), when they attempt to view it, then access is denied.

### Authorization
Requires `placementMatch.propose` to transition Draft → Proposed, held by Program Coordinator and Nova Administrator. Read access to the resulting Proposed match is scoped per viewer: the participant sees only their own match (resource scope = self); Shelter Manager and Shelter Supervisor see only matches for their own organization (resource scope = organization, via `hostOrganizationId`); both require the match to be at Proposed status or later — Draft is never visible to them regardless of scope.

### Lifecycle rules
Draft → Proposed requires all core fields present and is only reachable from Draft. Proposed → Expired is a time-based transition triggered when neither decision track has moved from Pending within the decision window. Both decision tracks are reset to Pending at the moment of proposal.

### Data changes
Updates `PlacementMatch.status` to Proposed, sets `participantDecision` and `shelterDecision` to Pending, and sets `proposedAt` and a decision-window expiration timestamp. Writes a lifecycle event and an audit event, since this is the point where participant and host information first crosses the organization boundary between Nova, the participant, and the shelter.

### UX and accessibility
- Proposed Placement Card (`docs/ux/component-guidelines.md`) rendered on the participant dashboard and the shelter dashboard's Placement approvals list.
- Respectful, plain-language participant copy (`docs/ux/content-style-guide.md`) — for example, "A placement has been proposed for you," not bureaucratic phrasing.
- Loading, empty, and error states per `docs/ux/wireframe-spec.md`'s required screen states.
- Mobile-first participant card; desktop-dense shelter approvals list, consistent with the Operations/Shelter density baseline.

### Tests
- Unit: required-field gate before proposing; Pending reset on both decision tracks; expiration-window calculation.
- Integration: the status transition persists with lifecycle and audit events; the expiration check transitions a stale Proposed match; role-shaped view models omit the correct fields per viewer.
- Component: the Proposed Placement Card renders correctly in the participant context and the shelter context, with no restricted content in either.
- E2E: a coordinator proposes a match; the participant and the shelter each see it on their respective dashboards; a different shelter cannot see it.

### Out of scope
Recording either decision (4.5, 4.6) and any email/push notification of the proposal — MVP relies on in-app visibility only (`docs/decisions/ADR-012-messaging-v2.md` defers messaging). Withdrawing a Proposed match before either party decides is also out of scope for MVP; a coordinator error is resolved operationally or left to run to a decision or expiration.

### Dependencies
Story 4.3 (a Draft must exist); Story 1.7 (participant and shelter protected layouts); Epic 3 readiness gates.

---

## Story 4.5 — Record participant decision

### Status
Ready for Development

### User story
As a participant, I want to accept or decline a placement that has been proposed to me, so that I retain control over my own transitional employment.

### Scope
- On a Proposed match, let the participant review the Proposed Placement Card and record Accept or Decline.
- Capture an optional participant note, most relevant on decline, using respectful, non-interrogative language.
- Allow a Program Coordinator to record the participant's decision on their behalf when it was communicated outside the portal (phone or in person), with the coordinator recorded as the actor and the participant recorded as the decision owner.
- A participant decline is a unilateral veto: it moves the match itself to Declined regardless of the shelter's track. A participant accept does not by itself approve the match — it only satisfies one of the two prerequisites checked in 4.8.
- Participants have exactly two options — Accept or Declined — there is no participant-side "request changes" path; only the shelter can request changes (4.6).

### Acceptance criteria
1. Given a Proposed match with `participantDecision` = Pending, when the participant accepts, then `participantDecision` becomes Accepted and the match stays at Proposed status unless the shelter has already approved, in which case it becomes eligible for final approval (4.8).
2. Given a Proposed match, when the participant declines, then `participantDecision` becomes Declined and the match transitions to Declined (terminal), regardless of the current shelter decision.
3. Given a decision communicated outside the portal, when a coordinator records it on the participant's behalf, then the same transition rules apply and the record shows the coordinator as the recording actor alongside the participant as the decision owner.
4. Given a match that is not at Proposed status (Draft, Declined, Withdrawn, Expired, or Approved), when a decision-recording action is attempted, then it is rejected.
5. Given a participant attempting to decide on a match that is not theirs, when the action is attempted, then it is denied.
6. Given a decline submitted with an optional note, when saved, then the note is visible to Operations but never exposed to the shelter as background or restricted content.

### Authorization
Requires `placementMatch.recordParticipantDecision`, held by the Participant role scoped to their own match only, and by Program Coordinator/Nova Administrator for assisted recording, scoped to the Nova organization. Requires the match to be at Proposed status.

### Lifecycle rules
`participantDecision`: Pending → Accepted or Declined. This is one-way for the current proposal cycle — there is no self-service reversal of an Accept or Decline; a changed mind routes through Operations rather than an open status dropdown (`RULES.md`: no arbitrary lifecycle status dropdowns). `participantDecision` = Declined forces the match's own status to Declined (terminal), independent of `shelterDecision`.

### Data changes
Updates `PlacementMatch.participantDecision`, `participantDecisionAt`, an optional `participantDecisionNote`, and `participantDecisionRecordedByUserId` (the participant themselves or an assisting coordinator); may update `PlacementMatch.status` to Declined. Writes a lifecycle event and an audit event recording who made the decision and, when applicable, who recorded it.

### UX and accessibility
- The Proposed Placement Card exposes clear Accept/Decline actions with a confirmation step, since both are effectively final for the current proposal.
- Respectful, plain decline language (`docs/ux/content-style-guide.md`) — for example, "You declined this placement" and "You may be matched with another opportunity," never "Rejected" or "Failed."
- Accessible confirmation modal/drawer with managed focus and a screen-reader-announced result.
- Mobile-first: this is primarily a participant-portal action and must work well on a phone.

### Tests
- Unit: decision-transition rules, including the unilateral-decline-forces-Declined rule and the Proposed-only gate.
- Integration: the persisted transition and audit trail, including the coordinator-assisted path.
- Component: Accept/Decline controls, the confirmation step, and accessible focus management.
- E2E: a participant accepts a proposed placement on their dashboard; a participant declines and the match becomes Declined; a coordinator records an assisted decision.

### Out of scope
The shelter decision (4.6), placement creation (4.8), and email/push notification of the outcome (`docs/decisions/ADR-012-messaging-v2.md`).

### Dependencies
Story 4.4 (the match must be Proposed); Story 1.5; Story 1.7 (participant layout).

---

## Story 4.6 — Record shelter decision

### Status
Ready for Development

### User story
As a Shelter Manager, I want to approve, request changes to, or decline a placement proposed for my organization, so that we only host arrangements we can safely support.

### Scope
- On a Proposed match, let the Shelter Manager review the Placement approvals item and record Approve, Request Changes, or Decline.
- Require a note when requesting changes or declining, so the coordinator has something actionable; the note is operational (schedule, supervisor, site) and never contains or requests participant background information — shelters never receive that information in the first place (`docs/product/compatibility-engine.md`).
- Let a Shelter Supervisor view a pending proposal within their organization's scope, read-only; only the Shelter Manager holds decision rights, consistent with `TERMINOLOGY.md` ("Shelter Manager: the partner representative approving placements").
- A shelter decline is a unilateral veto: it moves the match itself to Declined regardless of the participant's track. A shelter approval does not by itself approve the match — it only satisfies one of the two prerequisites checked in 4.8. A request for changes moves the match itself to Change Requested, handed to 4.7.

### Acceptance criteria
1. Given a Proposed match for their organization, when the Shelter Manager approves it, then `shelterDecision` becomes Approved and the match stays at Proposed status unless the participant has already accepted, in which case it becomes eligible for final approval (4.8).
2. Given a Proposed match, when the Shelter Manager requests changes with a note, then `shelterDecision` becomes Change Requested, the match transitions to Change Requested, and the note is attached for the coordinator.
3. Given a Proposed match, when the Shelter Manager declines it with a note, then `shelterDecision` becomes Declined and the match transitions to Declined (terminal), regardless of the current participant decision.
4. Given a Shelter Supervisor (not Manager) viewing a Proposed match for their organization, when they open it, then they can see it but the Approve/Request Changes/Decline actions are not available to them.
5. Given a match belonging to a different organization, when a Shelter Manager attempts to view or decide on it, then access is denied.
6. Given a match that is not at Proposed status, when a shelter-decision action is attempted, then it is rejected.

### Authorization
Requires `placementMatch.recordShelterDecision`, held by Shelter Manager only, scoped to their organization (`PlacementMatch.hostOrganizationId` must match an active Shelter Manager membership). Shelter Supervisor holds `placementMatch.view` in the same organization scope but not the decision permission. Requires the match to be at Proposed status.

### Lifecycle rules
`shelterDecision`: Pending → Approved, Change Requested, or Declined for the current proposal cycle; a fresh cycle after 4.7's revision resets it to Pending again. `shelterDecision` = Declined forces the match's own status to Declined (terminal). `shelterDecision` = Change Requested forces the match's own status to Change Requested, routed to 4.7.

### Data changes
Updates `PlacementMatch.shelterDecision`, `shelterDecisionAt`, `shelterDecisionNote` (required for Change Requested and Declined), and `shelterDecisionRecordedByUserId`; may update `PlacementMatch.status` to Change Requested or Declined. Writes a lifecycle event and an audit event.

### UX and accessibility
- Shelter dashboard "Placement approvals" list/card (`docs/ux/wireframes-layouts.md`), using the Proposed Placement Card and Application/Match Decision patterns from `docs/ux/component-guidelines.md`.
- Approve / Request Changes / Decline as explicit, verb-first labeled actions (`docs/ux/content-style-guide.md`).
- The note field is required and validated for Request Changes and Decline, with a programmatically associated error message.
- Text+icon status badges, never color alone; a visible read-only state for Shelter Supervisor.
- Mobile-first card suitable for a supervisor checking from the floor; a denser desktop list for a manager processing several proposals.

### Tests
- Unit: decision-transition rules, including the forced Declined/Change Requested side effects, the Proposed-only gate, and the required-note validation.
- Integration: organization-scope enforcement (cross-organization denial) and the persisted transition with its audit trail.
- Component: Approve/Request Changes/Decline controls and the Shelter Supervisor read-only state.
- E2E: a Shelter Manager approves a proposal; a different shelter cannot see or act on it; a Shelter Supervisor can view but not decide.

### Out of scope
The participant decision (4.5), acting on the change request itself (4.7), and placement creation (4.8).

### Dependencies
Story 4.4 (the match must be Proposed); Story 1.5; Story 1.7 (shelter layout); `docs/ops/shelter-onboarding.md` (Manager/Supervisor membership setup).

---

## Story 4.7 — Request changes

### Status
Ready for Development

### User story
As a Program Coordinator, I want to review a shelter's requested changes and either revise and re-propose the match or withdraw it, so that a Change Requested match doesn't stall the participant's progress.

### Scope
- Build a coordinator worklist/detail view for matches in Change Requested status, surfacing the shelter's note from 4.6 alongside the previously proposed terms.
- Let the coordinator edit the same fields available in 4.3 (site, supervisor, schedule, dates, candidate funding source).
- Provide two coordinator resolutions: revise and re-propose (returns to Proposed, both decision tracks reset to Pending, since the terms changed and prior consent cannot be assumed to carry over) or withdraw (Withdrawn, terminal; the participant reappears in the matching queue as Ready for Matching).
- Preserve prior decision values in history rather than overwriting them silently (`RULES.md`: preserve lifecycle history).
- Inform the participant, in plain language on their dashboard, that the placement is being revised, without exposing the shelter's internal operational note verbatim.

### Acceptance criteria
1. Given a match in Change Requested status, when the coordinator opens it, then the shelter's change-request note and the prior proposed terms are both visible.
2. Given a Change Requested match, when the coordinator edits the schedule, site, supervisor, or dates and re-proposes, then the match transitions to Proposed, both `participantDecision` and `shelterDecision` reset to Pending, and the prior decision values are retained in history rather than deleted.
3. Given a Change Requested match, when the coordinator withdraws it instead of revising, then the match transitions to Withdrawn (terminal) and the participant reappears in the matching queue (4.1) as Ready for Matching.
4. Given a Change Requested match, when the participant views their dashboard, then they see a plain-language status indicating the placement is being revised, without the shelter's internal operational note exposed verbatim.
5. Given a match that is not at Change Requested status, when a revise-or-withdraw action is attempted, then it is rejected.
6. Given a Participant or a Shelter Manager/Supervisor, when they attempt to edit or re-propose a Change Requested match, then access is denied — resolution is coordinator-only in MVP.

### Authorization
Requires `placementMatch.revise`, held by Program Coordinator and Nova Administrator, scoped to the Nova organization. Requires the match to be at Change Requested status for both the edit-and-repropose action and the withdraw action.

### Lifecycle rules
Change Requested → Proposed (revise-and-repropose): resets both decision tracks to Pending and requires the same core-field completeness check used in 4.4. Change Requested → Withdrawn: terminal, coordinator-elected. Prior `participantDecision`/`shelterDecision` values and their notes remain in the match's history rather than being deleted, per the archive-not-hard-delete rule.

### Data changes
Updates the same `PlacementMatch` fields as 4.3 (site, supervisor, schedule, dates, candidate funding source), resets `participantDecision` and `shelterDecision` to Pending on re-propose, and sets `status` to Proposed or Withdrawn. Appends to the match's lifecycle-event history without deleting prior decision records. Writes an audit event for both the edit and the resolution action.

### UX and accessibility
- Reuses the Draft-editing form from 4.3, plus a visible "Change requested" reason panel using the Blocker List / Status Transition Control patterns from `docs/ux/component-guidelines.md`.
- Participant-facing summary uses respectful, plain language (`docs/ux/content-style-guide.md`) — for example, "We're adjusting a detail on your proposed placement" — rather than the shelter's internal wording.
- Accessible confirmation for both the revise-and-repropose and withdraw actions, with screen-reader-announced results.
- Mobile-first form baseline within the desktop-optimized Operations shell.

### Tests
- Unit: the Change-Requested-only gate, the reset-to-Pending rule on re-propose, and history retention on edit.
- Integration: a transaction updates match fields, resets decisions, and writes lifecycle/audit events without deleting prior decision data.
- Component: the change-request detail view, the revise vs. withdraw actions, and the participant-facing summary.
- E2E: a coordinator revises a Change Requested match and it re-enters both dashboards as newly Proposed; a coordinator withdraws instead and the participant reappears in the queue.

### Out of scope
The shelter's act of requesting the change itself (4.6), placement creation (4.8), and participant- or shelter-initiated revision (coordinator-only in MVP).

### Dependencies
Story 4.6 (a Change Requested match must exist); reuses the edit-and-propose logic from Stories 4.3 and 4.4; Story 1.5.

---

## Story 4.8 — Approve match and create placement

### Status
Ready for Development

### User story
As a Program Coordinator, I want to give final approval to a match once both the participant and the shelter have agreed, so that a Placement is created and can proceed through shelter review of its site, supervisor, and schedule into onboarding.

### Scope
- Enable the "Approve match" action only when `participantDecision` = Accepted and `shelterDecision` = Approved on a Proposed match — the system surfaces eligibility, but a human coordinator must still take the explicit action (`docs/decisions/ADR-011-manual-matching.md`: the system never makes the final match decision).
- In a single transaction: transition the match to Approved (terminal/converted) and create a new `Placement`, carrying over the participant, program enrollment, host organization, site, candidate supervisor, candidate schedule, and candidate funding source reference from the match.
- Re-validate "no conflicting active placement" immediately before commit, since circumstances may have changed since the draft was built.
- Create the `Placement` starting at Draft status. The shelter's approval to host *this participant* happened at the match (the shelter decision track, Stories 4.6/4.8); the Placement's own Draft → Proposed → Shelter Review → Approved cycle (Epic 5, Story 5.2) is a distinct second gate where the Shelter Manager approves the specific site, supervisor, and schedule package (`docs/decisions/ADR-013-placement-review-model.md`, `docs/decisions/ADR-002-separate-lifecycles.md`). The created Placement is handed to Epic 5 at Draft, ready for site/supervisor/schedule assignment and shelter review.
- Link the resulting Placement back to its source match (`sourceMatchId`) so the relationship is traceable rather than merged or deleted.

### Acceptance criteria
1. Given a Proposed match with `participantDecision` = Accepted and `shelterDecision` = Approved, when the coordinator approves the match, then it transitions to Approved and a new Placement is created at Draft status in the same transaction, linked to the match.
2. Given a Proposed match where either decision track is not yet favorable (Pending, Declined, or the shelter track is Change Requested), when the coordinator attempts to approve it, then the action is blocked and the outstanding prerequisite is identified.
3. Given an approval attempt where the participant now has a conflicting onboarding/active/paused placement (for example, approved through a different match since this draft was built), when approval is attempted, then it is blocked with a clear conflict reason and no Placement is created.
4. Given the transactional approve-and-create operation, when any step fails, then no partial state is left — the match does not transition to Approved and no Placement is created.
5. Given a successfully approved match, when viewed afterward, then it shows Approved status with a reference to the resulting Placement, and its prior decision and revision history remains intact.
6. Given a user who is not a Program Coordinator or Nova Administrator, when they attempt to approve a match, then access is denied.

### Authorization
Requires `placementMatch.approve` together with `placement.create` (via `PlacementMatchService` and `PlacementService`, `docs/architecture/api-service-design.md`), held by Program Coordinator and Nova Administrator, scoped to the Nova organization. Requires the match to be at Proposed status with both decision tracks favorable — this is the epic's human-in-the-loop gate required by ADR-011.

### Lifecycle rules
Proposed → Approved (match; terminal/converted), gated on `participantDecision` = Accepted and `shelterDecision` = Approved, executed only through this explicit coordinator action — never automatically when both tracks happen to become favorable. Simultaneously establishes the Placement's initial lifecycle status of Draft, which Epic 5 (Story 5.2) carries through Proposed → Shelter Review → Approved and then into Onboarding and Active. Re-checks "no conflicting active placement" (`docs/product/business-rules.md`) as a business prerequisite immediately before commit.

### Data changes
Updates `PlacementMatch.status` to Approved and sets `approvedAt`/`approvedByUserId`. Creates `Placement` (`participantId`, `programEnrollmentId`, `hostOrganizationId`, `organizationSiteId`, `supervisorId`, `schedule`, a candidate funding reference, `sourceMatchId`, initial `status` = Draft) inside a single Prisma transaction. Writes lifecycle events on both the match and the new placement, plus an audit event for the approval. The one-onboarding/active/paused-placement-per-participant partial unique index (`docs/architecture/database-design.md`) is the hard backstop enforced at insert time, behind the application-level re-check in the acceptance criteria above.

### UX and accessibility
- The match-detail view surfaces "Approve match" as the primary action only when both decisions are favorable; otherwise it shows a Blocker List explaining what's outstanding (`docs/ux/component-guidelines.md`).
- A confirmation step precedes the irreversible transactional action, with an accessible, screen-reader-announced success or error result.
- On success, the view links directly into the new Placement's entry point (Epic 5, Story 5.1 — Placement workspace).
- The Concurrent update screen state (`docs/ux/wireframe-spec.md`) renders when the conflicting-placement re-check blocks approval, explaining what changed since the draft was built.

### Tests
- Unit: the approval-eligibility gate on both decision tracks and the conflicting-placement re-check.
- Integration: a Prisma transaction creates the Placement and updates the match atomically; the partial unique index prevents a second concurrent active placement; a failure path leaves no partial writes.
- Component: the Approve action's visible/disabled states tied to decision-track status, and the Blocker List and Concurrent update states.
- E2E: the full happy path — propose, participant accepts, shelter approves, coordinator approves, Placement exists and is reachable; a mid-flight conflicting placement blocks approval.

### Out of scope
Placement onboarding, activation, schedule confirmation, and funding assignment finalization (Epic 5, Stories 5.2–5.6); reporting on match-to-placement conversion (Epic 7). The Placement's own Draft → Proposed → Shelter Review → Approved cycle — where the Shelter Manager approves the specific site, supervisor, and schedule package — is owned by Epic 5, Story 5.2, and is a distinct second gate from this story's match-level approval; the two-gate model is documented in `docs/decisions/ADR-013-placement-review-model.md`.

### Dependencies
Stories 4.5 and 4.6 (both decision tracks must be favorable); Stories 4.3 and 4.4 (the match must exist and be Proposed); Epic 5 (the receiving epic for the created Placement, starting at Story 5.1); Story 1.5.
