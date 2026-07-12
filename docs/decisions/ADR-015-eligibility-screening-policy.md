# ADR-015 — Eligibility and screening policy (working policy)

## Status
Accepted as working policy. Production enablement of the review workflows is
gated on Washington employment-counsel review (`docs/ops/launch-checklist.md`).
Research basis: `docs/planning/policy-research-epic-2.md`.

## Decision

**Offense screening is individualized (case-by-case), never categorical, with
one narrow animal-care nexus screen.** This resolves open questions #1 and #2
(`docs/planning/open-questions.md`) and unblocks Stories 2.8 and 2.10.

### Intake eligibility (Story 2.8's rubric)

An applicant is **Eligible** when all of the following hold. Offense history
is NOT screened at intake — a criminal record is the qualifying condition of
this program, never an intake disqualifier (the pattern used by CEO, Safer
Foundation, Goodwill reentry programs, and DOL REO grantees):

1. 18 years of age or older.
2. Justice-involved: released from incarceration within the program window
   (default **7 years**) OR currently under community supervision
   (probation/parole). The window is a program parameter Nova leadership may
   tune without superseding this ADR.
3. Legally authorized to work in the United States.
4. Resides in, or can reliably reach, the program's service area.
5. Not currently blocked by a permanent disqualification (`ADR-016`).

Eligibility documentation follows DOL practice: **self-attestation is
acceptable** at intake, with the program assisting applicants in obtaining
documents afterward. The Not Eligible outcome uses reason categories drawn
from the rubric above (underage, outside program window, work authorization,
service area, disqualification block) — never an offense-based category.

### Background stage (Story 2.10's obligations)

Background review happens only AFTER an applicant is otherwise qualified and
conditionally advanced (mirroring RCW 49.94 as amended, effective
2026-07-01: otherwise-qualified determination + conditional offer before any
record inquiry). Obligations:

1. **FCRA mechanics** when a consumer reporting agency is used: standalone
   disclosure + written authorization before the check; two-step adverse
   action (pre-adverse packet with the report and the Summary of Rights;
   then a final notice with the agency's identity and dispute rights).
2. **Six-factor individualized assessment**, considered and documented in
   writing for any adverse concern (RCW 49.94): seriousness; number and
   types of convictions; time elapsed excluding incarceration; verifiable
   rehabilitation, good conduct, work experience, education, and training;
   the specific duties of the placement; place and manner of performance.
3. **Hold-open window of 5 business days** after the pre-adverse notice for
   the applicant to correct, explain, or show rehabilitation (satisfies both
   FCRA practice and Washington's 2-business-day floor).
4. **Never considered**: arrest records that did not lead to conviction, and
   juvenile records. Pre-offer inquiries are limited to convictions within
   ten years that reasonably relate to the work (WAC 162-12-140) — and this
   program makes no pre-offer inquiries at all.
5. **Animal-care nexus screen** (the single near-categorical element):
   convictions for animal cruelty, animal neglect, or animal fighting, and
   any **active court-ordered animal-possession ban (RCW 16.52.200)**, are
   presumptively disqualifying for hands-on animal-care placements — the
   six-factor assessment is still performed and documented, but the burden
   runs the other way. An active ban is decisive while it lasts: the person
   is legally barred from the core job function. Washington has no
   animal-abuser registry; this screen relies on the background report and
   court-order records.
6. A Disqualifying outcome invokes the shared rejection action (2.11).
   Whether it is ordinary (`REJECTED`) or permanent (`DISQUALIFIED`) follows
   `ADR-016` — a time-limited possession ban is ordinary rejection with
   reapplication possible after the ban lapses; only the narrow `ADR-016`
   categories are permanent.

### Who reviews (resolves open question #2's viewer)

- **Eligibility review**: Program Coordinator tier — `eligibilityReview.decide`
  under Nova organization scope (standard, not restricted).
- **Background review**: Restricted Review Specialist (or another role
  explicitly granted the permission) — `backgroundReview.view` and
  `backgroundReview.decide`, never implied by any base role including
  Program Coordinator, exactly as built in Story 2.7. Every access and
  decision writes an `AuditEvent`.

### Data handling

Background rationale and report content are **Highly Restricted**
(`docs/architecture/security-privacy.md`): never logged, excluded from every
view model except the restricted internal one, never exposed to applicants
beyond the simplified journey (2.6) or to shelters at all. Retention:
**at least 3 years** (2 CFR 200.334 governs as the longest applicable
period; 29 CFR 1602.14 minimum one year), extended during any charge,
audit, or litigation, followed by FCRA-compliant secure disposal.

## Rationale

Washington's amended Fair Chance Act makes the six-factor individualized
assessment a statutory mandate, not a best practice; the EEOC framework
(targeted screen + individualized assessment) points the same way, and a
grant-funded reentry employer adopting categorical exclusions would
contradict its own funding program's premise. The animal-care nexus screen
is the one place a near-categorical rule is defensible: animal-cruelty
convictions map directly to the specific risk of the specific job
(negligent-hiring nexus), and RCW 16.52.200 possession bans make the point
objectively — a banned person cannot lawfully perform the work. Risk
mitigation for everything else comes from the assessment process itself plus
the Federal Bonding Program and WOTC.

## Consequences

Stories 2.8 and 2.10 move to Ready for Development with this ADR as the
governing criteria set. The launch checklist gains a counsel-review gate;
until it clears, review workflows must not run against real applicants
(synthetic data only — consistent with every AC that previously said
"disabled in production until policy exists"). The intake window (7 years),
hold-open period (5 business days), and reason categories are program
parameters recorded here; tuning them is a program decision, while changing
the individualized-assessment model itself requires a superseding ADR.

This decision is binding for MVP. Changes require a superseding ADR.
