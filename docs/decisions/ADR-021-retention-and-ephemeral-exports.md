# ADR-021 — Provisional retention schedule and ephemeral exports (working policy)

## Status

Accepted as working policy (2026-07-14) — Colorado-counsel review of the
retention schedule is a launch gate, and **no deletion may be implemented
before that review**. Provisionally resolves open question #7
(`docs/planning/open-questions.md`); unblocks Story 7.5.

## Context

`docs/ops/data-governance.md` deferred retention periods to legal and
grant review, and Story 7.5 was blocked on two of its consequences: how
long records must exist, and what happens to exported artifacts. No
counsel has reviewed retention; per the standing rule for policy gaps,
this ADR adopts a defensible provisional position grounded in the
applicable minimums rather than inventing a settled policy.

Research basis (2026-07-14, jurisdiction per `ADR-019`):

- **2 CFR 200.334** — federal award records: 3 years from submission of
  the final financial report, extended until any litigation, claim, or
  audit started within that window is resolved.
- **29 CFR 516 (FLSA)** — payroll records 3 years; the records wage
  computations rest on (time records) 2 years.
- **29 CFR 1602.14 (EEOC)** — personnel records 1 year (involuntary
  termination: 1 year from termination), extended during any charge.
- **Colorado** — unemployment-insurance work records **5 years** (the
  longest applicable driver); Colorado Wage Act records ~3 years after
  employment ends; HFWA leave records 2 years.
- **FCRA / 16 CFR 682** — no retention period; a secure-disposal duty
  whenever disposal eventually happens.

Nova's timesheets are simultaneously payroll-supporting and
grant-supporting records, so the safe rule is: the longest applicable
period wins.

## Decision

### 1. Provisional retention schedule

- **All program records** are retained at least **5 years after the
  related placement or enrollment ends** (Colorado work-record driver),
  **or 3 years after the final financial report of any funding award the
  record supports (2 CFR 200.334), whichever is later.**
- Retention **extends automatically** while any audit, charge, claim, or
  litigation involving the records is unresolved.
- **Audit events are never deleted** (Story 7.6's append-only rule) —
  they are the program's accountability record.
- When deletion eventually happens, consumer-report-derived records get
  **FCRA-secure disposal** (16 CFR 682): wiped, not merely unlinked.
- **MVP implements no deletion paths at all** — unchanged from today's
  behavior. Deletion arrives only as a future, counsel-approved, manual
  process; nothing in ordinary workflows can permanently delete.

### 2. Exports are ephemeral

- Named exports (Story 7.5) are **generated on demand by a Route Handler
  and streamed to the requester — never written to object storage**. No
  export artifact exists at rest, so there is no artifact-retention
  question and no second copy of sensitive data to protect.
- The **audit event is the durable record** of every export: actor,
  export name, scope, and timestamp (Story 7.6 reviews them).
- Each named export carries a **fixed field allow-list** (the ADR-020
  principle): restricted contents are excluded by construction, and the
  hours export inherits ADR-020's provisional-format flag until award
  validation.

## Consequences

- Story 7.5 is unblocked; its original "write to secure object storage"
  sketch is superseded by the ephemeral design (story doc updated in the
  same change set).
- `docs/ops/data-governance.md` now cites this schedule; open question
  #7 is resolved-provisional.
- Launch checklist gains the gate: Colorado counsel validates the
  retention schedule (and the no-deletion posture) before launch; any
  future deletion capability requires that review plus a superseding ADR.
- If a funder's award terms demand stored export artifacts or longer
  periods, that arrives as an award-validation finding under ADR-020's
  gate and supersedes the ephemeral rule for that export.

This decision is binding for MVP. Changes require a superseding ADR.

## Sources

- 2 CFR § 200.334 (eCFR):
  <https://www.ecfr.gov/current/title-2/subtitle-A/chapter-II/part-200/subpart-D/subject-group-ECFR4acc10e7e3b676f/section-200.334>
- 29 CFR Part 516 (eCFR): <https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-516>
- 29 CFR § 1602.14 (eCFR):
  <https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1602/subpart-C/section-1602.14>
- FTC Disposal Rule, 16 CFR Part 682:
  <https://www.ftc.gov/legal-library/browse/rules/disposal-consumer-report-information-records>
- CDLE, Employer audits (unemployment-insurance record inspection):
  <https://cdle.colorado.gov/employers/employer-audits>
- CDLE, INFO #3A — Timing of wage payments and required record-keeping:
  <https://cdle.colorado.gov/sites/cdle/files/INFO%20%233A%20Timing%20of%20Wage%20Payments,%20&%20Required%20Record-Keeping%2007.11.2023%20accessible.pdf>
