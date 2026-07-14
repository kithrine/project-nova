# ADR-020 — Provisional grant reporting format (working format)

## Status

Accepted as working format (2026-07-14) — validation against executed award
documents is a launch gate (`docs/ops/launch-checklist.md`). Provisionally
resolves open question #6 (`docs/planning/open-questions.md`); unblocks
Story 7.2. Story 7.5 additionally remains blocked on retention periods
(open question #7).

## Context

`docs/ops/grant-operations.md` requires exact grant fields and reporting
formats to be validated against actual awards — but no awards are executed
yet, so there is nothing to validate against. Per the standing rule for
policy gaps (`docs/planning/open-questions.md`): build the unambiguous
mechanism, defer the policy-dependent part, and never invent a policy as if
it were settled.

What *is* settled:

- **Federal Uniform Guidance, 2 CFR 200.430**: personnel charges to federal
  awards must rest on "records that accurately reflect the work performed,"
  with daily hours for non-exempt hourly employees and internal controls
  assuring accuracy. Epic 6 built exactly this pipeline — daily work entries,
  server-computed hours, supervisor approval, Nova lock, append-only events,
  and audit — so finalized (`LOCKED`) timesheets are the reimbursement-safe
  record basis.
- **No universal state format exists to copy**: Colorado workforce grants
  (CDLE/WIOA and state programs such as the WORK Act) publish award-specific
  reporting requirements, which confirms that the final column schema can
  only come from each executed award.
- `ADR-010` binds each placement to a single active funding assignment, so
  every hour attributes entirely to one funding source — no blended splits.

## Decision

Adopt the following **provisional pilot format** for "Approved hours by
funding source" (Story 7.2). It is built only from fields the system already
holds and is visibly flagged as provisional wherever it renders.

1. **Reporting period**: a selected date range. Each timesheet week
   (Monday–Sunday) attributes to the period containing its **Monday**
   (`weekStartDate`) — deterministic, and contiguous periods never
   double-count a week.
2. **Grouping**: one group per funding source, identified by name, kind, and
   award code (`FundingSource.code`) when set.
3. **Measures per group**, kept strictly separate:
   - **Finalized hours** — exact `Decimal` sum of `LOCKED` timesheet totals
     (the reimbursement-safe basis, Story 6.7);
   - **Approved, not yet finalized** — exact `Decimal` sum of `APPROVED`
     timesheet totals, displayed distinctly and never blended into the
     finalized figure;
   - contributing placement count.
4. **Grand totals** across groups, same separation.
5. **Hours only.** No dollar computations in MVP — `FundingAssignment`
   carries `hourlyRate`/`hoursCap`, but reimbursement math belongs to the
   award-validated format, not the provisional one.
6. **Provisional flag**: the report surface carries a visible notice —
   provisional pilot format, pending validation against executed awards
   (this ADR) — so no consumer mistakes it for an approved reimbursement
   artifact.

## Consequences

- Story 7.2 moves to **Ready for Development**; open question #6 is marked
  resolved-provisional against this ADR.
- Story 7.5's export field sets follow the same allow-list principle when
  built, but 7.5 stays blocked on retention periods (open question #7).
- **Launch gate**: before any real reimbursement use, validate the field set
  and format against each executed award and either confirm this ADR or
  supersede it with the award-specific schema. `docs/ops/grant-operations.md`
  records the same.
- Tuning the provisional columns (adding an award-required field) is a
  program decision recorded here; changing the attribution rule, the
  finalized/approved separation, or introducing dollar math requires a
  superseding ADR.

This decision is binding for MVP. Changes require a superseding ADR.

## Sources

- 2 CFR 200 Subpart E (eCFR):
  <https://www.ecfr.gov/current/title-2/subtitle-A/chapter-II/part-200/subpart-E>
- DOL, 2 CFR Part 200 FAQs (2025-01-15):
  <https://www.dol.gov/sites/dolgov/files/OASAM/legacy/files/20250115-2CFRPart200FAQs.pdf>
- CDLE, WIOA program and policy guidance letters:
  <https://cdle.colorado.gov/wioa-workforce-innovation-and-opportunity-act-policy-guidance-letters>
