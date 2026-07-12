# Open Policy Questions

Unresolved legal, grant, payroll, screening, and retention questions that block or constrain implementation. Stories marked **Blocked — pending policy validation** depend on the items below. Per `AGENTS.md` (Handling blocked and unresolved items): build the unambiguous mechanism, stub the policy-dependent part behind a clear `TODO`, and do not invent a policy. Add new questions here as they surface, and when one is resolved, update the affected stories in the same change set (`RULES.md` → Documentation synchronization).

## Questions blocking specific stories

| # | Question to resolve | Blocks | Source | Status |
|---|---|---|---|---|
| 1 | Exact eligibility / screening criteria; is offense screening categorical or case-by-case? | Story 2.8 | `docs/planning/assumptions.md` | Resolved — individualized assessment + narrow animal-care nexus screen (`ADR-015`; counsel-review launch gate) |
| 2 | Background-check legal obligations; who may view background detail (restricted permission) | Story 2.10 | `docs/architecture/security-privacy.md`, `assumptions.md` | Resolved — FCRA/RCW 49.94 obligations codified; restricted viewer = Restricted Review Specialist (`ADR-015`) |
| 3 | Permanent-disqualification policy wording | Stories 2.10, 2.11 | `docs/planning/assumptions.md` | Resolved — three narrow categories, 30-day reapplication window, approved templates (`ADR-016`) |
| 4 | Who may terminate a placement | Story 5.8 | `docs/planning/assumptions.md` | Open |
| 5 | Participant access to evaluations | Story 5.10 | `docs/planning/assumptions.md` | Open |
| 6 | Exact grant fields and reporting formats (validate against actual awards) | Stories 7.2, 7.5 | `docs/ops/grant-operations.md` | Open |
| 7 | Record and export retention periods | Story 7.5; deletion behavior app-wide | `docs/ops/data-governance.md` | Open |

## Broader "needs validation" items

These constrain the program and several stories but are not tied to a single story.

| # | Question to resolve | Source | Status |
|---|---|---|---|
| 8 | Payroll and tax workflows; payroll provider | `docs/planning/assumptions.md`, `docs/ops/pilot-operating-model.md` | Open |
| 9 | Employer-of-record partner; insurance and workers' compensation structure | `docs/planning/risks.md`, `docs/planning/project-discovery.md` | Open |
| 10 | Document storage provider | `docs/planning/assumptions.md` | Open |
| 11 | Jurisdiction-specific screening requirements | `docs/planning/project-discovery.md` | Open |
| 12 | Shelter capacity and supervision commitments | `docs/planning/project-discovery.md` | Open |

## Resolving an item

When an answer arrives: set its Status to `Resolved`, link the resolving ADR or doc, unblock the affected stories (update their Status from **Blocked — pending policy validation** to **Ready for Development**), and make those updates in the same change set.
