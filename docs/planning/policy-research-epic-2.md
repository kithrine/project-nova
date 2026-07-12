# Policy Research — Epic 2 Screening, Background, and Decision Policies

> **Research, not legal advice.** This document synthesizes legal-landscape and
> program-design research conducted 2026-07-12 to support the working policies
> in `ADR-015` and `ADR-016`. It was prepared for a capstone project and has
> not been reviewed by counsel. Washington employment counsel must review the
> adopted policies before any review workflow runs against real applicants
> (gated in `docs/ops/launch-checklist.md`).

Scope: U.S. federal law plus Washington State (the program's assumed
jurisdiction), current as of July 2026. Two timing notes shape everything
below:

- **Washington's amended Fair Chance Act took effect July 1, 2026** — days
  before this research — so there is little interpretive guidance yet; treat
  the statutory text as controlling and monitor for Attorney General guidance.
- **Federal disparate-impact enforcement is in flux (2025–2026)**: executive
  actions have deprioritized EEOC disparate-impact enforcement, but the
  underlying Title VII law is not repealed, private plaintiffs and state
  agencies can still sue, and Washington's own statutes are actively
  expanding. Build to the stricter standard.

---

## Part I — Legal landscape

### 1. EEOC framework (Title VII)

- EEOC *Enforcement Guidance on the Consideration of Arrest and Conviction
  Records in Employment Decisions*, No. 915.002 (Apr 25, 2012) — guidance
  interpreting Title VII disparate-impact law (42 U.S.C. § 2000e-2(k);
  *Griggs v. Duke Power Co.*).
  <https://www.eeoc.gov/laws/guidance/enforcement-guidance-consideration-arrest-and-conviction-records-employment-decisions>
- The **Green factors** (*Green v. Missouri Pacific Railroad*, 549 F.2d 1158
  (8th Cir. 1977)): (1) nature/gravity of the offense, (2) time elapsed since
  the offense or sentence completion, (3) nature of the job sought.
- The practical safe harbor is a **targeted screen (Green factors) plus an
  individualized assessment**: notice that a record may screen the person
  out, an opportunity to show the exclusion should not apply (rehabilitation,
  post-conviction work history, references, bonding, circumstances), and
  genuine consideration of that showing.
- **Blanket/categorical exclusions** ("no felons") are inconsistent with the
  Green factors and create disparate-impact exposure.
- **Arrests are not convictions**: an exclusion based on an arrest itself is
  not job-related; only underlying conduct may be considered. (Washington law
  goes further — see below.)
- 2025–2026 federal enforcement pullback noted above changes EEOC posture,
  not the statute; the 2012 guidance has not been formally rescinded.

### 2. FCRA (when a consumer reporting agency runs the check)

- **Standalone disclosure + written authorization** before procuring a report
  — a document consisting *solely* of the disclosure (15 U.S.C. § 1681b(b)(2)).
- **Two-step adverse action** (§ 1681b(b)(3), § 1681m(a)):
  1. *Pre-adverse action*: copy of the report + CFPB "Summary of Your Rights
     Under the FCRA," before deciding; hold a reasonable window (practice:
     ~5 business days).
  2. *Final adverse action*: name/address/phone of the reporting agency, a
     statement that the agency did not make the decision, and the right to a
     free copy within 60 days and to dispute accuracy.
- **Disposal Rule** (16 CFR Part 682): secure destruction of consumer-report
  data when no longer needed.
- FTC employer guide:
  <https://www.ftc.gov/business-guidance/resources/using-consumer-reports-what-employers-need-know>
- Watch item: CFPB Circular 2024-06 extends FCRA duties to algorithmic
  screening tools — relevant if automated scoring is ever considered.

### 3. Washington State

**Fair Chance Act, RCW 49.94, as amended effective July 1, 2026**
(<https://app.leg.wa.gov/RCW/default.aspx?cite=49.94>;
AG resources: <https://www.atg.wa.gov/fair-chance-act>):

- No record inquiry until the employer both determines the applicant is
  **otherwise qualified** *and* makes a **conditional offer**.
- Adverse action on an adult conviction requires a **legitimate business
  reason** — good-faith belief the conduct will negatively affect job
  performance or harm people, property, or business reputation/interests.
- **Six factors must be considered and documented**: (1) seriousness of the
  conduct; (2) number and types of convictions; (3) time elapsed (excluding
  incarceration); (4) verifiable rehabilitation, good conduct, work
  experience, education, training; (5) specific duties of the position;
  (6) place and manner of performance.
- **Absolute bars**: no adverse action based on arrest records or juvenile
  convictions.
- **Process**: identify the specific record relied on; hold the position open
  **at least two business days** for the applicant to correct, explain, or
  show rehabilitation; issue a **written decision** documenting the factor
  assessment; provide the AG's Fair Chance Act guide when notifying of a
  background check.
- Enforcement by the Washington Attorney General (escalating penalties
  $1,500 / $3,000 / $15,000 per violation). Effective 2026-07-01 for
  employers with 15+ employees; 2027-01-01 below that.
- **Exemption to assess per role**: positions with unsupervised access to
  children or vulnerable persons. Whether any Nova shelter placement
  qualifies must be evaluated at counsel review.

**Seattle Fair Chance Employment Ordinance (SMC 14.17)** — applies to
Seattle-based work: legitimate-business-reason standard, identify the record,
opportunity to explain, hold open two business days.
<https://www.seattle.gov/laborstandards/ordinances/fair-chance-employment>

**WAC 162-12-140** (WA Human Rights Commission): pre-employment conviction
inquiries are fair only for convictions **within the last ten years** that
**reasonably relate to job duties**.
<https://apps.leg.wa.gov/WAC/default.aspx?cite=162-12-140>

### 4. Negligent hiring and the animal-care nexus

- Washington recognizes negligent hiring/retention where the employer knew or
  should have known of an undue risk with a **nexus** between the job and the
  harm. The resolution is the same job-relatedness analysis fair-chance law
  requires: exclude only where specific past conduct maps to a specific risk
  of the specific job.
- **Animal-cruelty convictions have a direct, demonstrable nexus to
  hands-on animal-care work** — the clearest job-relatedness case available
  to this program.
- **RCW 16.52.200**: Washington courts must impose an order prohibiting
  owning, caring for, possessing, or residing with animals on conviction —
  **permanent** for first-degree animal cruelty and animal fighting;
  **two years** for lesser offenses (restoration petition possible after
  five years). A candidate under an active order is legally barred from the
  core job function.
  <https://app.leg.wa.gov/RCW/default.aspx?cite=16.52.200>
- **Washington has NO statewide animal-abuser registry.** One search source
  claimed a 2016 "Animal Abuse and Neglect Registry"; primary-source review
  found no such registry — only unenacted proposals. Statewide registries
  exist elsewhere (Tennessee; Florida's "Dexter's Law" effective Jan 2026);
  New York has county-level registries only. Screening therefore relies on
  the criminal-history report and any RCW 16.52.200 court order.
- ASPCA opposes registries and favors individualized approaches:
  <https://www.aspca.org/about-us/aspca-policy-and-position-statements/position-statement-animal-abuser-registries>

### 5. Record retention

- **29 CFR 1602.14** (Title VII): hiring records one year (longer while a
  charge or suit is pending).
- **2 CFR 200.334** (federal grants): three years from submission of the
  final expenditure report — the longest generally applicable period, so it
  governs by default for this grant-funded program.
- **16 CFR 682.3** (FCRA Disposal Rule): secure destruction after retention
  ends.

### 6. Federal support programs

- **Federal Bonding Program**: free $5,000 fidelity bonds, $0 deductible,
  first six months — direct mitigation of the theft-risk rationale behind
  negligent-hiring fears. WA administration via the Employment Security
  Department. <https://bonds4jobs.com>
- **WOTC** (IRC § 51, "qualified ex-felon" hired within one year of
  conviction or release; Form 8850 within 28 days of start): **in a
  reauthorization lapse for hires after 2025-12-31** as of July 2026 — keep
  filing timely to preserve retroactive eligibility.
- **DOL Reentry Employment Opportunities (REO)** grants expect fair-chance
  practices, individualized services, and Federal Bonding use — a
  categorical-exclusion policy would be inconsistent with the funding
  program's premise. <https://www.dol.gov/agencies/eta/reentry>

---

## Part II — Program-model norms

### 7. How established reentry employers set eligibility

- **Center for Employment Opportunities**: 18+, has a conviction, on
  supervision or recently released, unemployed — the conviction is the
  *qualifying* condition; no offense screen at intake. Host worksites may
  carry site-specific restrictions, handled at placement.
  <https://www.ceoworks.org/our-model>
- **Safer Foundation**: serves anyone with a record; intake windows keyed to
  release recency/supervision. <https://saferfoundation.org/>
- **Goodwill affiliates**: recency windows (San Antonio: released within
  5 years; New Orleans: within 7 years) rather than offense screens.
- **Homeboy Industries**: deliberately serves those with the most barriers;
  relationship-based intake.
- **DOL REO grantees**: enroll to the funding announcement's eligibility
  criteria, not an offense screen.
- **Pattern**: eligibility = recency-of-release window + supervision status;
  offense-specific concerns move downstream to the placement decision.

### 8. Animal-shelter screening norms

- Background checks are standard for shelter staff/volunteers; the one
  category treated sector-wide as a true nexus concern is
  **animal cruelty/neglect/fighting** (e.g., Humane Society of the Pikes
  Peak Region declines prior neglect/cruelty convictions; Humane World for
  Animals reviews case-by-case but flags crimes against animals). Some
  shelters blanket-screen all felonies — exactly the over-broad approach
  fair-chance law warns against.

### 9. Individualized assessment in practice

- Employer toolkits (SHRM "Getting Talent Back to Work," NELP fair-chance
  toolkit, Dave's Killer Bread Foundation) converge on: a written baseline
  policy, a candidate questionnaire capturing context and post-offense
  history, a centralized trained reviewer for consistency, and documentation
  of the factors weighed.
  <https://www.shrm.org/content/dam/en/shrm/foundation/getting-talent-back-to-work-toolkit.pdf>
- Where offense-category matrices are used, the defensible design outputs
  only "clear" or "**individualized review required**" — never automatic
  disqualification; courts have rejected matrices used as final adjudication.

### 10. Respectful adverse communication

- The FCRA two-touch sequence doubles as the respectful-communication spine:
  a pre-decision letter that invites the applicant's side, then a
  plain-language final letter explaining the job-relatedness reason and
  preserving dispute rights.
- Good tone/wording models: California Civil Rights Department Fair Chance
  Act sample forms (<https://calcivilrights.ca.gov/fair-chance-act/fca-forms/>)
  and NYC Commission on Human Rights Fair Chance materials.
- Never: automatic-bar framing, character judgment, deciding before the
  response window closes.

### 11. Permanent disqualification norms

- Second-chance programs avoid categorical permanent bars almost entirely.
  The defensible narrow categories: (a) a direct, unmitigable nexus to the
  work (for shelters: an active permanent animal-possession ban), and (b)
  conduct against the program itself (violence or fraud within the program).
  Everything else is time-limited, keyed to recency and rehabilitation.

### 12. Grant compliance basics

- DOL REO eligibility is documented per the funding announcement;
  **self-attestation is DOL-endorsed** for this population (TEGL 23-19,
  Change 1, Attachment 2), with post-enrollment help obtaining IDs.
- Participant records report to the PIRL layout; eligibility determinations,
  dates, and outcomes must be documentable.

---

## Conclusions adopted as working policy

| Open question | Conclusion | Adopted in |
|---|---|---|
| #1 Eligibility / screening: categorical or case-by-case? | Individualized (case-by-case) with one narrow animal-care nexus screen; no offense screening at intake | `ADR-015` |
| #2 Background-check legal obligations; restricted viewer | Conditional-acceptance gating, FCRA two-step, six-factor documented assessment, 5-business-day hold, ≥3-year retention; restricted viewer = Restricted Review Specialist | `ADR-015` |
| #3 Permanent-disqualification wording | Three narrow categories; approved applicant-facing templates; 30-day reapplication window after ordinary rejection | `ADR-016` |

Verification flags for counsel review: the WA "unsupervised access to
vulnerable persons" exemption question; case citations marked as general
legal knowledge in the underlying research; WOTC reauthorization status.
