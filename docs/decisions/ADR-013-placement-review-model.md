# ADR-013 — Placement review model

## Status
Accepted

## Decision
The shelter approves a placement at two distinct gates. First, at the **Match** (Epic 4): the Shelter Manager's decision track approves hosting the participant. Second, at the **Placement** (Epic 5, Story 5.2): after the coordinator assigns the specific site, supervisor, and schedule, the placement moves Draft → Proposed → Shelter Review, and the Shelter Manager approves that logistics package (Shelter Review → Approved). Approving a match (Story 4.8) therefore creates the Placement at Draft, not Approved.

## Rationale
The two approvals answer different questions: the match asks "will you host this participant?"; the placement shelter review asks "do this site, supervisor, and schedule work?". Keeping both preserves an explicit host sign-off on placement logistics, matches the documented placement lifecycle in `docs/product/placement-lifecycle.md`, and keeps Placement Match and Placement as separate lifecycle objects (ADR-002). It also resolves an inconsistency in the story backlog, where Story 4.8 created the Placement at Approved while Story 5.2 implemented a distinct Shelter Review cycle.

## Consequences
Story 4.8 creates the Placement at Draft and hands it to Epic 5, Story 5.2, which enacts Proposed → Shelter Review → Approved before onboarding. The alternative — collapsing to a single match-level approval and creating the Placement at Approved — was considered and rejected to retain an explicit host sign-off on the specific site, supervisor, and schedule. This decision is binding for MVP. Changes require a superseding ADR.
