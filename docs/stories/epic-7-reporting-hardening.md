# Epic 7 — Reporting and Production Readiness

## Goal
Provide pilot reporting and safely launch.

## Stories

| ID | Story | Status |
|---|---|---|
| 7.1 | Active placement summary | Done |
| 7.2 | Approved hours by funding source | Done |
| 7.3 | Shelter roster | Done |
| 7.4 | Outcome summary | Done |
| 7.5 | Scoped exports | Done |
| 7.6 | Audit review | Done |
| 7.7 | Accessibility hardening | Done |
| 7.8 | Security tests | Done |
| 7.9 | Production launch checklist | Ready for Development |

> Sequencing note: 7.1–7.6 are read-only reports built on data from earlier epics — start with 7.1 (simplest, Operations placement data), then 7.3 and 7.4; 7.2 depends on locked timesheets (Epic 6); 7.6 depends on audit events written across Epics 2–6; 7.5 (exports) builds on the reports in 7.1–7.4 and the audit trail in 7.6, so build it after them. 7.7 (accessibility) and 7.8 (security) are hardening passes over the whole app and should run once the feature surfaces exist. 7.9 (launch) is last and depends on 7.7 and 7.8 passing. 7.2 was unblocked on 2026-07-14 by `ADR-020` (provisional pilot format; award validation is a launch gate), and 7.5 on the same day by `ADR-021` (provisional retention schedule; exports are ephemeral and never stored) — both keep counsel/award validation as launch gates; see each story's Dependencies.

---

## Story 7.1 — Active placement summary

### Status
Done

> **Built (2026-07-14):** `reporting.view` joins the registry — Program
> Coordinator, Grant Administrator, and Nova Administrator read Nova-wide;
> the Shelter Manager holds it organization-scoped (this story's service
> scoping; the shelter-side surface arrives with 7.3's roster). Supervisors,
> participants, and RRS are never granted it (registry sweep). The new
> `ReportingService.getActivePlacementSummary` returns only in-progress
> placements (`Onboarding`/`Active`/`Paused` — `ACTIVE_PLACEMENT_STATUSES`),
> selects only permitted columns (AC5's query-layer exclusion), scopes
> shelter viewers to their membership organizations (filters intersect the
> scope, never widen it), and shapes filter options from the scoped set so
> organization names never leak. Operations → Reports goes live in the nav
> (index page lists 7.2/7.3 as disabled entries), with the report at
> `/operations/reports/active-placements`: GET-form filters (host
> organization, stage, coordinator) with a live count, sortable
> participant/organization/stage/start-date headers (`aria-sort`), stage as
> SVG icon + text, mobile stacked cards enhancing to the md+ table, and
> distinct empty states for "no in-progress placements" vs "no filter
> matches". Integration battery: in-progress-only + terminal/pre-onboarding
> exclusion, filter narrowing with counts, Shelter Manager org scoping with
> no-widening proof, restricted-field regex sweep, participant/supervisor
> denial. E2E: coordinator filters the live report; a shelter user is denied
> at the operations boundary.

### User story
As a Program Coordinator, I want a summary of all in-progress placements, so that I can see the state of the pilot at a glance and act on what needs attention.

### Scope
- Build a read-only Operations report listing in-progress placements (`Onboarding`, `Active`, `Paused` per `docs/product/placement-lifecycle.md`) with: participant, host organization, site, supervisor, coordinator, current lifecycle stage, and start date.
- Provide filters by host organization, lifecycle stage, and coordinator, with a live result count.
- Return role-shaped view models: Nova Operations sees all; a Shelter role (if given access) sees only its own organization's placements. No restricted fields (no background details, no case notes, no government identifiers).
- Reachable from Operations → Reports (`docs/ux/information-architecture.md`); reads through a `ReportingService` (`docs/architecture/api-service-design.md`).

### Acceptance criteria
1. Given a Program Coordinator with `reporting.view`, when they open the Active Placement Summary, then it lists every in-progress placement with participant, host, site, supervisor, coordinator, stage, and start date.
2. Given the filters, when the coordinator filters by host organization or lifecycle stage, then the list narrows accordingly and the result count updates.
3. Given a Shelter Manager with access, when they open the summary, then only placements at their own organization appear (organization scope).
4. Given a terminal placement (Completed, Converted to Permanent Employment, Withdrawn, or Terminated), when the summary renders, then it is excluded from the in-progress list.
5. Given the report payload, when inspected, then it contains no restricted fields — no background details, internal case notes, or government identifiers.
6. Given no in-progress placements, when the report renders, then the Empty state is shown.

### Authorization
`reporting.view`, granted to Nova Operations roles; organization-scoped for any shelter role given access. The server returns a role-shaped view model per `docs/architecture/architecture.md`; raw Prisma records are never returned. Restricted fields are excluded at the query layer, not just hidden in the UI.

### Lifecycle rules
Read-only. Reflects each placement's current lifecycle stage and excludes terminal placements from the active view. Transitions nothing.

### Data changes
None (read-only). May introduce a `ReportingService` query; no new tables.

### UX and accessibility
Accessible data table with sortable columns; lifecycle stage shown with text and icon, never color alone; Loading, Empty, Error, and Permission denied states (`docs/ux/wireframe-spec.md`); mobile-first (stacked cards at small viewports, denser table on the desktop Operations view per `docs/ux/ux-spec.md`); SVG-only icons; keyboard-navigable with semantic table markup.

### Tests
- Unit: in-progress-vs-terminal filtering; role-shaped view-model selection.
- Integration: organization scoping returns only in-scope placements; no restricted fields present in the result.
- Component: table renders populated, empty, and permission-denied states with accessible headers.
- E2E: a coordinator opens the summary and sees active placements; a shelter user sees only their own organization's.

### Out of scope
Hours and funding rollups (7.2), outcome reporting (7.4), exporting (7.5), and any placement edits (Epic 5).

### Dependencies
Epic 5 (placements exist), 1.5 (authorization context), 1.7 (Operations protected layout), and the `reporting.view` permission.

---

## Story 7.2 — Approved hours by funding source

### Status
Done — built on `ADR-020` (provisional pilot format; validation against executed awards is a launch-checklist gate)

> **Built (2026-07-14):** pure domain first
> (`src/server/domain/reporting.ts`): `parseReportRange` (valid ISO range or
> the current UTC month; injected clock), `mondayWithinRange` (ADR-020's
> attribution — a week belongs to the period containing its Monday, so
> contiguous periods never double-count), and `rollupHoursByFunding`, which
> sums stored Decimal-shaped strings through Story 6.3's exact
> integer-hundredths helpers — `LOCKED` and `APPROVED` accumulate
> separately and are never blended (AC3). The service
> (`getApprovedHoursByFundingSource`) requires `reporting.view` **plus Nova
> scope** — a Shelter Manager holding the permission for the org-scoped
> reports is still denied here (funding reach is Nova-only). Attribution
> uses each placement's single ACTIVE funding assignment (ADR-010);
> placements without one roll up under a visible "No funding assigned"
> bucket rather than vanishing. The report page
> (`/operations/reports/hours-by-funding`) renders the **provisional
> ADR-020 notice on its face in every state**, a date-range GET form,
> per-source groups (name, kind, award code) with separate
> finalized/approved columns and a grand-total footer, mobile cards
> enhancing to the md+ table. Unit: range defaults/fallbacks, boundary
> attribution, float-trap exactness (0.10+0.20), status filtering,
> single-group attribution. Integration (run-id-derived week anchor so
> shared-DB runs never collide): exact per-source Decimal strings,
> Monday-boundary inclusion/exclusion, SUBMITTED exclusion, unassigned
> bucket, PC permitted, SM/participant denied, no restricted fields or
> participant identifiers, invalid-range fallback. E2E: the Grant
> Administrator filters to Harper's fixture January week and reads 12.34
> locked hours under "E2E Grant Fund (Synthetic)" (deterministic fixtures:
> Harper's placement now carries the grant assignment and one LOCKED
> January timesheet).

### User story
As a Grant Administrator, I want approved work hours rolled up by funding source, so that I can prepare accurate reimbursement support for each grant.

### Scope
- Roll up finalized work hours as exact `Decimal` totals, grouped by each placement's single active funding source (`docs/decisions/ADR-010-funding.md`), for a selected date range.
- Prefer `LOCKED` timesheets (finalized, 6.7) as the reimbursement-safe basis; clearly distinguish any `APPROVED`-but-unlocked totals rather than blending them silently.
- Build the rollup mechanism now, rendering the **provisional pilot format** adopted in `ADR-020` (grouped by funding source name/kind/award code; weeks attributed to the period containing their Monday; hours only). The award-validated schema remains deferred (`docs/ops/grant-operations.md`, "Open requirements") and the report is visibly flagged provisional.
- Read-only; role-shaped view models; no restricted fields.

### Acceptance criteria
1. Given locked timesheets across placements, when the report runs for a date range, then approved hours are summed as exact `Decimal` totals grouped by funding source.
2. Given a placement's single active funding assignment (ADR-010), when its hours are rolled up, then they attribute entirely to that one funding source — there is no blended split in MVP.
3. Given both `LOCKED` and `APPROVED`-but-unlocked hours exist, when the report runs, then finalized (`LOCKED`) totals are distinguished from approved-but-unlocked totals rather than merged.
4. Given the report payload, when inspected, then it contains no participant background details or other restricted fields — only permitted aggregates and identifiers.
5. Given the exact grant fields and reporting format are not yet validated, when this story is implemented, then the rollup logic is built but the final column schema and format remain deferred and clearly flagged.

### Authorization
`reporting.view` plus a funding scope, granted to Grant Administrator and Nova Administrator (and Program Coordinator where permitted). Server-side only; role-shaped output.

### Lifecycle rules
Reads finalized timesheet states (`LOCKED` preferred, `APPROVED` distinguished). Read-only; transitions nothing.

### Data changes
None. Reads `Timesheet` (`Decimal` hours), `FundingAssignment`, and `FundingSource`.

### UX and accessibility
Grouped, accessible table with per-funding-source subtotals and a grand total; consistent `Decimal` formatting; text-based status; Loading, Empty, and Error states; mobile-first with a denser desktop Operations view; SVG-only icons.

### Tests
- Unit: `Decimal` summation and grouping by funding source; finalized-state filtering.
- Integration: single-funding attribution (no blending); organization/funding scope enforcement; no restricted fields present.
- Component: grouped totals and empty state render accessibly.
- E2E: locked hours appear under the correct funding-source group with an exact total.

### Out of scope
Automated reimbursement packets, blended/cost-category allocation, and a funder portal (all V3, `docs/ops/grant-operations.md`); payroll; exporting this report (7.5).

### Dependencies
Epic 6 (locked timesheets, 6.7), Story 5.3 (funding assignment), and Story 1.8 (funding sources must exist). **Unblocked (2026-07-14):** `ADR-020` adopts the provisional pilot format and resolves open question #6 provisionally; validating it against each executed award is a launch-checklist gate. Retention periods (open question #7) concern stored export artifacts (7.5), not this on-screen report.

---

## Story 7.3 — Shelter roster

### Status
Done

> **Built (2026-07-14):** `getShelterRoster` reads every HOST organization
> in the viewer's scope — Nova viewers get all shelters INCLUDING
> zero-placement ones (AC3's zero-count rule lives in the pure
> `mergeSiteCounts` helper, unit-tested); a Shelter Manager gets only
> their own organization(s). Counts cover the ACTIVE tier
> (Onboarding/Active/Paused) via one `groupBy`; staff comes from ACTIVE
> `SHELTER_MANAGER`/`SHELTER_SUPERVISOR` memberships only, so the query
> can never select participant data (AC4 — plus a payload regex sweep).
> One shared `ShelterRoster` component serves two surfaces: the
> Operations report (`/operations/reports/shelter-roster`, index entry
> flipped on) and the shelter experience's **Organization** page
> (`/shelter/organization`, nav item flipped on) — the org-scoped shelter
> surface promised in 7.1's built note. Supervisors do not hold
> `reporting.view`, so the Organization nav item shows them the
> Permission-denied state; the roster is a Shelter Manager surface.
> Integration: all-orgs-with-zero-counts, ACTIVE-tier-only counting
> (WITHDRAWN/DRAFT excluded), manager contact + ACTIVE-membership-only
> supervisors, SM org scoping, participant/supervisor denial, no
> participant fields. E2E: the coordinator reads both fixture shelters on
> the ops report; the Shelter Manager's Organization page shows their own
> shelter and never the other one.

### User story
As a Program Coordinator, I want a roster of participating shelters, so that I can see partner capacity and engagement at a glance.

### Scope
- List host organizations and their sites with: configured capacity, current active-placement count, assigned supervisors, and the Shelter Manager contact.
- Return role-shaped view models: Nova Operations sees all shelters; a Shelter Manager sees only their own organization (organization scope).
- Read-only; organization-level data only (no restricted participant data).
- Reachable from Operations → Shelters / Reports (`docs/ux/information-architecture.md`).

### Acceptance criteria
1. Given a coordinator with `reporting.view`, when they open the Shelter Roster, then each participating host organization appears with its sites, configured capacity, active-placement count, and assigned supervisors.
2. Given a Shelter Manager, when they view the roster, then only their own organization is shown.
3. Given a shelter with no active placements, when the roster renders, then it shows a zero count rather than being omitted.
4. Given the payload, when inspected, then no restricted participant data is included — the roster is organization-level.
5. Given no participating shelters, when rendered, then the Empty state is shown.

### Authorization
`reporting.view` for Nova Operations; organization-scoped for shelter roles. Role-shaped output; never raw Prisma.

### Lifecycle rules
Read-only. Reflects current membership and placement state; transitions nothing.

### Data changes
None. Reads `Organization`, `OrganizationSite`, `Membership`, and `Placement` (for counts).

### UX and accessibility
Accessible list/table showing capacity versus active count numerically; text-based status; Loading, Empty, and Error states; mobile-first cards enhancing to a desktop table; SVG-only icons; semantic markup and keyboard navigation.

### Tests
- Unit: active-placement count aggregation per organization.
- Integration: organization scoping; capacity and supervisor reads; no restricted fields.
- Component: roster renders populated and empty states accessibly.
- E2E: a coordinator sees all shelters; a Shelter Manager sees only their own.

### Out of scope
Creating or editing shelter/site records and capacity (shelter onboarding/admin), and any participant-level detail.

### Dependencies
Epic 1 (organizations, sites, memberships), Epic 5 (placements for counts), and the `reporting.view` permission.

---

## Story 7.4 — Outcome summary

### Status
Done

> **Built (2026-07-14):** `getOutcomeSummary` — one `groupBy` over the
> four terminal placement statuses plus a certification count, Nova scope
> only, aggregates only (the query cannot select participant rows; the
> integration payload sweep and an exact key-shape assertion prove it).
> Date scoping uses each placement's terminal effective date (`endDate`,
> written by every 5.8 transition) and `Certification.issuedOn`; the
> default is **program to date** (`parseOptionalReportRange` — null means
> unbounded; only a complete valid ordered pair narrows). Zero-filled
> counts in canonical order come from the pure `buildOutcomeCounts`
> (a category with no placements shows 0, never disappears). The page
> (`/operations/reports/outcome-summary`) renders icon-plus-text cards
> with neutral one-line descriptions ("Participants who chose to step
> away.", "Placements ended by Nova Operations."), a date form with a
> program-to-date reset, and the component test asserts no stigmatizing
> language renders (AC3). E2E: fixtures add Harper's COMPLETED placement
> (endDate 2026-02-10) and one February credential — a period no journey
> spec writes into — so the coordinator reads exact counts (Completed 1,
> Credentials 1, Withdrawn 0).

### User story
As a Nova Administrator, I want a summary of participant outcomes, so that I can report program impact to funders and stakeholders.

### Scope
- Aggregate employment outcomes: placements Completed, Converted to Permanent Employment, Withdrawn, and Terminated (`docs/product/placement-lifecycle.md`), plus credentials/certifications earned (Epic 3).
- Support a date-range filter.
- Frame all outcomes in respectful, plain language (`docs/ux/content-style-guide.md`); describe terminal states neutrally.
- Read-only; aggregate-level; role-shaped; no restricted individual data.

### Acceptance criteria
1. Given completed and terminal placements, when the outcome summary runs, then it reports counts of Completed, Converted to Permanent Employment, Withdrawn, and Terminated.
2. Given certifications recorded in Epic 3, when the summary runs, then credentials earned are counted.
3. Given the report, when rendered, then language is respectful and plain — never "failed" or stigmatizing — and terminal states are described neutrally.
4. Given the payload, when inspected, then it contains no restricted personal details — aggregates only, or permitted identifiers under reporting scope.
5. Given a date-range filter, when applied, then outcomes are scoped to that range.

### Authorization
`reporting.view`, granted to Nova Operations / Nova Administrator. Aggregate, role-shaped output; server-side only.

### Lifecycle rules
Reads terminal placement states and `EmploymentOutcome` records. Read-only.

### Data changes
None. Reads `Placement` (terminal states), `EmploymentOutcome`, and `Certification`.

### UX and accessibility
Accessible summary cards and counts; text and icon, never color alone; Loading, Empty, and Error states; mobile-first; SVG-only icons; respectful copy throughout.

### Tests
- Unit: outcome categorization and counting.
- Integration: aggregates exclude restricted fields; date-range scoping.
- Component: cards render populated and empty states accessibly.
- E2E: outcomes reflect completed and converted placements after the fact.

### Out of scope
The public impact dashboard and advanced analytics (V3), and any per-participant narrative.

### Dependencies
Epic 5 (terminal placements and `EmploymentOutcome`), Epic 3 (certifications), and the `reporting.view` permission.

---

## Story 7.5 — Scoped exports

### Status
Done — unblocked by `ADR-021` (provisional retention schedule; ephemeral exports)

> **Built (2026-07-14):** four named exports over the 7.1–7.4 reports,
> each a **fixed field allow-list** (`EXPORT_DEFINITIONS`) rendered by a
> pure, hardened CSV writer (RFC-4180 quoting, CRLF, spreadsheet
> formula-injection guard — unit-tested). `runNamedExport` requires the
> new `report.export` permission (Grant Administrator and Nova
> Administrator only; registry sweep) plus Nova scope, builds rows from
> the role-shaped report views (restricted fields excluded by
> construction), **writes the audit event that is the export's durable
> record** (action `report.export`, subject `Export/<key>`, detail =
> name + period; AC2), and returns the CSV. **Deviation from the
> original scope sketch:** per `ADR-021`, exports are generated on
> demand by the Route Handler (`/api/exports/[exportKey]`) and streamed
> with `no-store` — never written to object storage, so no artifact
> retention exists and the audit trail is the record. Denied callers get
> neither a file nor an audit event (AC4, integration-proven). The
> picker (`/operations/reports/exports`, restricted) makes the
> disclosure itself the confirmation step: the complete field list and
> the audit notice precede the download control; the hours export
> carries `ADR-020`'s provisional note. E2E closes 7.6's deferred
> journey: the Grant Administrator downloads the shelter roster, reads
> the CSV's exact allow-listed header, then finds the `report.export`
> event in Audit review; a coordinator is denied at both the page and
> the Route Handler.

### User story
As a Grant Administrator, I want to export scoped report data, so that I can share required information with funders without exposing restricted details.

### Scope
- Provide named, permission-controlled exports of the reports above (active placements, approved hours by funding source, shelter roster, outcomes). Each export is a named artifact with an approved, fixed field set (`docs/product/business-rules.md`, Privacy).
- Every export writes an **audit event** recording actor, export name, scope, and timestamp (`docs/architecture/security-privacy.md`, `docs/ops/data-governance.md`).
- Exports never include restricted contents — no background details, internal case notes, government identifiers, or serious-incident narratives; there is no restricted global search.
- Implement export/download via a Route Handler (`docs/architecture/api-service-design.md`), writing to secure object storage.
- Build the export and audit mechanism now. The exact approved field sets and the retention of exported artifacts are **pending validation** (grant fields; retention periods) and are deferred and flagged.

### Acceptance criteria
1. Given a permitted user, when they run a named export, then they receive only the approved field set for that export, scoped to their permission and organization.
2. Given any export runs, when it completes, then an audit event is written recording the actor, export name, scope, and timestamp.
3. Given restricted data exists on the underlying records, when an export is produced, then no background details, internal case notes, government identifiers, or serious-incident narratives appear in the output.
4. Given a user without export permission, when they attempt an export, then it is denied (Permission denied) and no file is produced.
5. Given the approved field sets and artifact retention are not yet validated, when this story is implemented, then the export and audit mechanism are built but the exact fields and retention remain deferred and clearly flagged.

### Authorization
A dedicated `report.export` permission plus scope, granted to Grant Administrator and Nova Administrator (and Program Coordinator where permitted); never to participants; shelter roles only for their own organization's permitted named exports. Server-side; every export is audited.

### Lifecycle rules
Read-only over report data; each export is an audited event. Audit events are never hard-deleted.

### Data changes
Writes an `Audit Event` per export. No changes to source records. Export artifacts are stored securely; artifact retention is TBD pending review.

### UX and accessibility
A named-export picker with a confirmation step; download via the Route Handler; Loading, Success, Permission denied, and Restricted states; accessible controls; mobile-first; SVG-only icons; respectful copy.

### Tests
- Unit: field-set allow-listing (restricted fields excluded by construction).
- Integration: an audit event is written per export; permission and scope enforcement; no restricted contents in output.
- Component: export dialog renders its states accessibly.
- E2E: a permitted user exports and an audit event is recorded; an unpermitted user is denied.

### Out of scope
Scheduled report delivery and enhanced file workflows (V2); the final export field schema and retention policy (pending validation).

### Dependencies
7.1–7.4 (report data) and 7.6 (audit trail), plus the `report.export` permission. **Blocked on:** export/record-retention periods undefined pending legal and grant review (open question #7, `docs/ops/data-governance.md`). The field-set half is provisionally resolved — named-export field sets follow `ADR-020`'s allow-list principle, validated against executed awards at launch.

---

## Story 7.6 — Audit review

### Status
Done

> **Built (2026-07-14):** `audit.view` is deliberately narrower than
> reporting: **Nova Administrator and Grant Administrator only** — even a
> Program Coordinator gets Permission denied (registry sweep, integration,
> and an E2E journey all prove it). `listAuditEvents` (audit-service):
> newest-first over the append-only trail, capped at 100 with an honest
> "showing the N most recent" truncation note and a true total; filters
> narrow by actor, action code, resource type, and date window (AC2), with
> filter options built from the events themselves. Rows carry actor name,
> action, subject TYPE + ID reference, the 2.7-constrained non-sensitive
> detail line, and a UTC timestamp — never record contents (AC4; row-shape
> assertion + payload sweep). AC5's append-only rule is tested two ways:
> the audit module exposes no update/delete/purge export, and listing
> never changes the row count. Audit and lifecycle events remain distinct
> stores. Surface: `/operations/administration/audit` (Administration
> gains the link, marked restricted). E2E: a deterministic anchor event
> (subject `e2e_audit_anchor`, shaped like a real 6.7 lock) lets the
> Grant Administrator find and filter a known row; the "export event from
> 7.5" journey lands with Story 7.5.

### User story
As a Nova Administrator, I want to review audit events, so that I can verify that sensitive actions and exports are properly recorded and investigate any concerns.

### Scope
- Build an Operations view over audit events: sensitive-data access, exports, lifecycle transitions, and permission-restricted actions. Filter by actor, resource, event type, and date.
- Keep audit and lifecycle events distinct (`docs/architecture/architecture.md`).
- Read-only; audit events are append-only and never hard-deleted; the audit review surface is itself a privileged, restricted action.

### Acceptance criteria
1. Given recorded audit events, when an administrator opens Audit Review, then events display with actor, action, resource reference, and timestamp.
2. Given the filters, when applied (actor, resource, type, or date), then the list narrows accordingly.
3. Given a non-privileged user, when they attempt to open Audit Review, then they receive the Permission denied state.
4. Given an audit event, when viewed, then it references the action and resource without exposing restricted record contents.
5. Given audit events, when any deletion is attempted through normal workflows, then it is not possible (append-only / archived).

### Authorization
A privileged `audit.view` permission, granted to Nova Administrator (and Grant Administrator where permitted). Server-side; restricted; role-shaped.

### Lifecycle rules
Read-only over an append-only audit store; audit events are never hard-deleted.

### Data changes
None. Reads `Audit Event`.

### UX and accessibility
Accessible, filterable table; text-based status; Loading, Empty, Error, and Permission denied states; mobile-first; SVG-only icons; sensitive references shown without exposing restricted contents.

### Tests
- Unit: filter logic.
- Integration: audit events are readable but not deletable through the app; permission gating; no restricted contents leaked.
- Component: table, filters, and permission-denied state render accessibly.
- E2E: an administrator reviews audit events, including an export event produced by 7.5.

### Out of scope
External log shipping / SIEM integration (future) and analytics over audit data.

### Dependencies
1.5 (authorization context), audit-writing across features (Epics 2–6), and the `audit.view` permission.

---

## Story 7.7 — Accessibility hardening

### Status
Done

> **Built (2026-07-14):** the systematic pass is recorded in
> `docs/ux/accessibility-review-2026-07.md`. Automated coverage now has
> two layers: the CI merge gate (public pages + 360px, axe WCAG A/AA —
> `tests/e2e/a11y.spec.ts`, unchanged as the blocking check) and the new
> authenticated sweep (`tests/e2e/a11y-authenticated.spec.ts`) scanning
> ~21 signed-in screens across all four experiences — five fixture roles
> incl. the placement workspace via click-through — plus a keyboard test
> (skip link first, lands on `#main-content`, visible focus outline) and
> a reduced-motion verification. The sweep lives in the full local suite
> because CI's preview job is deliberately smoke-only (fixed-id fixtures
> cannot survive concurrent CI runs); ci-cd.md documents the split.
> Fixes: `prefers-reduced-motion` support added app-wide (none existed),
> and the one axe finding — 50%-opacity text failing AA contrast —
> corrected in six places to the `/60` standard. Screen-reader
> structural equivalents (roles, names, landmarks, `aria-current`,
> `aria-sort`, `sr-only` annotations) are asserted across the component
> suites; a live screen-reader spot check with real users stays on the
> launch checklist's accessibility gate.

### User story
As a Nova engineer, I want a full accessibility hardening pass, so that the pilot meets WCAG 2.2 AA and works for every participant, supervisor, and staff member.

### Scope
- Conduct a systematic WCAG 2.2 AA review across all four experiences using the methods in `docs/ux/accessibility.md`: automated checks, keyboard-only review, screen-reader spot checks, contrast review, and form-error review.
- Verify: semantic HTML, visible focus, labels above inputs, programmatic error association, text-and-icon status (never color alone), logical tab order, reduced-motion support, screen-reader route/transition announcements, no drag-and-drop-only actions, responsive zoom and reflow, and SVG-only icons with accessible labels (no emojis).
- Wire an automated accessibility check into CI (component/E2E stage) as a merge gate (`docs/architecture/ci-cd.md`).

### Acceptance criteria
1. Given the app, when the automated accessibility check runs in CI, then it passes the agreed ruleset with no violations, and failures block merge.
2. Given each critical screen, when navigated by keyboard only, then all actions are reachable and operable with visible focus and a logical order.
3. Given status indicators, when reviewed, then none rely on color alone, and every icon is an SVG with an accessible label or is marked decorative.
4. Given a form, when a validation error occurs, then it is programmatically associated with its field and announced to assistive technology.
5. Given a reduced-motion preference, when set, then non-essential motion is suppressed.

### Authorization
Not applicable (cross-cutting quality work).

### Lifecycle rules
None.

### Data changes
None.

### UX and accessibility
This story is the accessibility gate; it applies the full `docs/ux/accessibility.md` checklist across all four experiences and every critical component.

### Tests
- Unit: not applicable.
- Integration: not applicable.
- Component: automated accessibility assertions and keyboard-navigation tests on key components.
- E2E: an automated accessibility scan runs on critical journeys in CI; the manual review checklist is recorded.

### Out of scope
Full WCAG AAA conformance and localization/internationalization.

### Dependencies
All feature epics (screens must exist to harden) and 1.6 (CI to host the automated gate).

---

## Story 7.8 — Security tests

### Status
Done

> **Built (2026-07-14):** the consolidated battery lives in
> `tests/integration/security-boundaries.test.ts` on a two-host-org
> fixture chain: cross-organization denial across placements (the
> workspace carries incidents and every tab), timesheets (read AND
> approve), and applications; raw applications, background surfaces, and
> case notes unreachable for shelter roles — with the shelter's own
> workspace payload proven structurally free of case-note/background
> content, and background denied even to coordinators (RRS-only). AC2's
> no-client-trusted-claims is proven by construction and by revocation:
> authorization derives only from server-resolved ACTIVE memberships, so
> deactivating a manager's membership revokes every read on the next
> request with nothing client-side to forge or replay (filter-no-widening
> was proven per-report in 7.1–7.3). AC4's lifecycle gates: a permitted,
> in-scope supervisor cannot approve a DRAFT week and a coordinator
> cannot lock a SUBMITTED one — both `LifecycleError`, distinct from
> authorization. Authorization errors stay generic (no resource contents
> in messages). `tests/e2e/security.spec.ts` runs the canonical
> cross-shelter journey by direct URL on every shelter surface, proves
> shelter DOMs never contain application/background/case-note content,
> and rejects an unsigned Clerk webhook with a detail-free 400 (AC5).
> Deny-by-default permission sweeps continue to live in
> `permissions.test.ts` (one per story since 1.5).

### User story
As a Nova engineer, I want a suite of security tests, so that authorization boundaries and sensitive-data protections are verified before launch.

### Scope
- Cover authorization boundaries: cross-organization access denial; permission + scope + lifecycle gating; deny-by-default; and no client-trusted claims (forged roles, organization IDs, or permissions are ignored server-side).
- Cover sensitive-data non-exposure: shelters cannot view raw applications, background details, or internal case notes; background decisions require a restricted permission; there is no restricted global search; and no sensitive contents appear in logs, errors, or exports.
- Cover Clerk webhook signature verification and restricted queries for sensitive data.
- Include the "cross-shelter access is denied" end-to-end journey (`docs/architecture/testing-strategy.md`).

### Acceptance criteria
1. Given a user from organization A, when they request organization B's resource, then access is denied — verified across placements, timesheets, incidents, and applications.
2. Given a client request supplying a forged role, organization, or permission, when processed, then the server ignores it and authorizes from server-resolved data.
3. Given a shelter role, when they attempt to view background details, internal case notes, or raw applications, then access is denied and the data is absent from the payload.
4. Given a lifecycle-gated action (for example, approving a non-`SUBMITTED` timesheet), when attempted, then it is denied even with permission and scope.
5. Given an unsigned Clerk webhook, when received, then it is rejected.

### Authorization
These tests exercise the authorization core (1.5) and the domain lifecycle gates across all epics.

### Lifecycle rules
Tests lifecycle-state gating across domains (`Authorization = Permission + Resource Scope + Lifecycle State`).

### Data changes
None. Tests use synthetic data with the isolation helpers from 1.3 and 1.6.

### UX and accessibility
Not applicable (verification work), though tests assert that Permission denied and Restricted states render without leaking data.

### Tests
- Unit: permission resolution, deny-by-default, and restricted-permission gating.
- Integration: cross-organization denial across aggregates; restricted queries; webhook signature verification; no restricted fields in role-shaped view models.
- Component: Permission denied and Restricted states render without exposing data.
- E2E: the "cross-shelter access is denied" journey — a shelter user cannot reach another organization's placement or a participant's background.

### Out of scope
External penetration testing and automated dependency/secret scanning setup (possible follow-ups).

### Dependencies
1.5 and all feature epics (boundaries to exercise), and 1.6 (CI).

---

## Story 7.9 — Production launch checklist

### Status
Ready for Development

### User story
As a Nova Administrator, I want the production launch checklist implemented and verified, so that we go live safely and consistently with our operating model.

### Scope
- Implement and verify the go-live gates from `docs/ops/launch-checklist.md` across its Technical, Legal/operations, and People categories, and keep this story consistent with that document — if behavior differs, update `docs/ops/launch-checklist.md` in the same change set (`RULES.md`, Documentation synchronization).
- Technical gates: production Clerk configured, production Neon configured, migrations applied via `prisma migrate deploy`, custom domain active, branch protection active, backups verified, logs and alerts verified, E2E smoke tests pass, accessibility review complete (7.7), and synthetic test data removed.
- Legal/operations and People gates are operational sign-offs (tracked, not code): employer-of-record agreement, shelter agreements, insurance, screening policy, incident procedures, grant requirements mapped, payroll process; staff and partner training; and documented escalation contacts.
- Provide a launch-readiness surface for Nova Administration (or a documented runbook) reflecting the gate states.

### Acceptance criteria
1. Given the production environment, when configured, then production Clerk and Neon are separate from nonproduction, migrations are applied via `prisma migrate deploy`, and the custom domain resolves to production.
2. Given branch protection and CI, when a release is prepared, then no direct push to `main` is possible and required checks (including E2E smoke and accessibility) pass.
3. Given the "synthetic test data removed" gate, when checked, then no synthetic or test data remains in production.
4. Given backups, logs, and alerts, when verified, then each is confirmed operational before launch.
5. Given the launch checklist behavior changes, when implemented, then `docs/ops/launch-checklist.md` is updated in the same change set.

### Authorization
Nova Administrator for the launch-readiness surface. The Legal/operations and People gates are human sign-offs recorded operationally.

### Lifecycle rules
None (release process, not a domain lifecycle).

### Data changes
None in the application schema; ensures synthetic data is removed from production.

### UX and accessibility
If a launch-readiness surface is built, it follows mobile-first, accessible, text-based-status conventions with SVG-only icons; otherwise a documented runbook is maintained.

### Tests
- Unit: any readiness-check helper logic.
- Integration: migrations-applied and health checks pass against a production-like configuration.
- Component: the launch-readiness surface renders gate states (if built).
- E2E: the production smoke suite (app boots, health check, sign-in) passes.

### Out of scope
Ongoing post-launch operations, incident runbooks beyond documented escalation contacts, and marketing launch activities.

### Dependencies
1.6 (CI and branch protection), 7.7 (accessibility), 7.8 (security), and Epics 1–6 complete; stays consistent with `docs/ops/launch-checklist.md`.
