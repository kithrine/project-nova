# ADR-019 — Program jurisdiction is Colorado (corrects the Washington research assumption)

## Status

Accepted (2026-07-14). Corrects the jurisdiction assumption underlying
`ADR-015` through `ADR-018` and the Epic 2/3 policy research; re-points every
employment-counsel launch gate to **Colorado** counsel
(`docs/ops/launch-checklist.md`).

## Context

The Epic 2 policy research scoped itself to "U.S. federal law plus Washington
State (the program's **assumed** jurisdiction)"
(`docs/planning/policy-research-epic-2.md`). The assumption entered during
research and propagated into `ADR-015`–`ADR-018`, the launch checklist, and
open question #13 — it was never validated with the program owner. On
2026-07-14 the program owner confirmed the program operates in **Colorado**.

`docs/planning/project-discovery.md` never named a state; it lists
"jurisdiction-specific screening requirements" as an open validation area
(open question #11), which this ADR partially answers.

## Decision

**Colorado is the operating jurisdiction.** The adopted policies stand
unchanged:

- Their federal foundations — FCRA adverse-action mechanics, the EEOC
  individualized-assessment framework, and 2 CFR 200 record standards — are
  jurisdiction-neutral.
- Washington-derived practices that exceed Colorado's legal floor (the
  written six-factor assessment, the otherwise-qualified-before-inquiry
  sequence, the 5-business-day hold-open window, the 10-year job-related
  lookback) are **retained as deliberate program policy**, now grounded in
  EEOC guidance and program values rather than state mandate.

Washington citations in `ADR-015`–`ADR-018` and the policy-research documents
read through this map:

| Washington basis (as cited)                                                                                 | Colorado / federal basis                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RCW 49.94 Fair Chance Act (otherwise-qualified determination + conditional advance before any record inquiry; written assessment; 2-business-day response floor) | **C.R.S. § 8-2-130, Chance to Compete Act**: bars criminal-history questions on the *initial application* and "no records need apply" advertisements; applies to all private employers (since 2021-09-01); enforced by CDLE with graduated penalties. Colorado does **not** mandate the assessment sequence or timing — Nova retains them as program policy. Likely relevant exception: employers "participating in a … government program to encourage the employment of people with criminal histories" — counsel to confirm Nova qualifies. |
| WAC 162-12-140 (pre-offer inquiry limits; 10-year job-related lookback)                                        | No direct Colorado analog. The 10-year job-related lookback is retained as program policy under the EEOC nexus rationale; counsel to confirm any Colorado limits on consumer-report contents.                                                                                                                                                            |
| Washington negligent-hiring common law (knew-or-should-have-known exposure)                                    | **C.R.S. § 8-2-201(2)**: an employee's criminal history may not be introduced as evidence in civil actions against the employer based on that employee's conduct (statutory exceptions preserved) — a stronger employer shield than Washington offers, directly supporting the second-chance hiring model.                                             |
| RCW 16.52.200 (mandatory court-ordered animal-possession bans; no statewide abuser registry)                   | **C.R.S. § 18-9-202** (cruelty to animals): Colorado courts may order animal-possession restrictions in sentencing — generally discretionary rather than mandatory; counsel to confirm scope and permanence categories used by `ADR-016`. Colorado likewise has no statewide abuser registry; the screen continues to rely on the background report and court-order records. |
| WISHA / Chapter 296-801 WAC; L&I written Accident Prevention Program                                           | **Colorado has no state OSHA plan.** Federal OSHA covers private employers (Region 8, Denver); duties arise from 29 CFR 1910 standards (hazard communication, PPE, etc.) and the general duty clause — there is no general written-safety-program mandate, though specific standards require written programs. Colorado adds a **heat-illness prevention rule (7 CCR 1103-15)** relevant to outdoor animal work. Open question #13 is re-pointed accordingly. |
| RCW 49.48 (final-pay timing, cited in `ADR-018`'s counsel gate)                                                | **Colorado Wage Claim Act, C.R.S. § 8-4-109**: wages due immediately upon involuntary termination (stricter than Washington). Payroll workflows remain outside this app; the counsel gate carries the citation.                                                                                                                                          |
| WA Employment Security Department (WOTC / Federal Bonding administration)                                      | **Colorado Department of Labor and Employment (CDLE)** administers WOTC and the Federal Bonding Program in Colorado.                                                                                                                                                                                                                                     |
| Washington Attorney General enforcement (fair-chance)                                                          | **CDLE** enforcement (warning, then fines up to $1,000 / $2,500 on repeat violations).                                                                                                                                                                                                                                                                   |

## Consequences

- Every launch-checklist counsel gate now names **Colorado employment
  counsel** (`docs/ops/launch-checklist.md`), and the safety-duty gate reviews
  federal OSHA + 7 CCR 1103-15 instead of WAC 296-801.
- `ADR-015`–`ADR-018` receive dated correction notes pointing here; their
  decisions and mechanics are unchanged. The Epic 2/3 policy-research
  documents remain unedited as historical records behind correction banners.
- Open question #11 is narrowed (jurisdiction known: Colorado); #13 is
  re-worded to the federal-OSHA duty-allocation question.
- **Colorado counsel verification items** consolidated for launch: the
  § 8-2-130 government-program exception; § 8-2-201(2) shield scope; how
  § 18-9-202 possession restrictions map to `ADR-016`'s
  permanent-vs-time-limited categories; consumer-report content limits; local
  fair-chance ordinances if the service area includes home-rule cities
  (e.g., Denver); and the § 8-4-109 final-pay process at the payroll partner.

This decision is binding for MVP. Changes require a superseding ADR.

## Sources

- CDLE, INFO #9C — Chance to Compete Act:
  <https://cdle.colorado.gov/sites/cdle/files/INFO%20%239C%20Chance%20to%20Compete%20Act%2012.8.23%20%5Baccessible%5D.pdf>
- CDLE, Chance to Compete Act FAQs (2024):
  <https://cdle.colorado.gov/sites/cdle/files/Colorado%20Chance%20to%20Compete%20Act%20FAQs%209.17.24.pdf>
- C.R.S. § 8-2-130 (Justia, 2024):
  <https://law.justia.com/codes/colorado/title-8/labor-i-department-of-labor-and-employment/labor-relations/article-2/part-1/section-8-2-130/>
- C.R.S. § 8-2-201 — limitation on admission of criminal history (FindLaw):
  <https://codes.findlaw.com/co/title-8-labor-and-industry/co-rev-st-sect-8-2-201.html>
- OSHA State Plans (Colorado not listed — federal jurisdiction):
  <https://www.osha.gov/stateplans>
