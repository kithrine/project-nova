# ADR-018 — Placement termination is a Nova Operations action, single actor (working policy)

## Status

Accepted as working policy (2026-07-13) — production enablement gated on Washington employment-counsel review (`docs/ops/launch-checklist.md`). Resolves open question #4 (`docs/planning/open-questions.md`); unblocks Story 5.8.

## Decision

The **Terminated** outcome — the involuntary end of a placement — is recorded by **Nova Operations only, by a single authorized actor**: a Program Coordinator or Nova Administrator holding the `placement.terminate` permission. There is no second-approver step and no shelter-side termination capability.

- The action requires a **reason category** — Safety concern / Conduct or policy violation / Sustained non-attendance / Other — plus a free-text note and an effective date, entered behind a Confirmation Panel that names the irreversible nature of the choice.
- **Shelters never terminate.** A shelter that needs a participant removed documents the circumstances through Incidents (Story 5.11 — Serious/Emergency reports alert Nova Operations immediately) or day-to-day context through Evaluations; a coordinator then acts. This is the escalation pathway MVP already ships; no separate "request termination" object is added.
- The other three terminal outcomes — Completed, Converted to Permanent Employment, Withdrawn — follow the same Nova-Operations single-actor pattern under a `placement.complete` permission, as Story 5.8 already specified. Withdrawn records the participant's stated reason; it is the participant's choice, recorded by a coordinator.
- Terminal placements are never reopened (`docs/product/business-rules.md`); the transition, its reason, and the actor are preserved on the placement's lifecycle event in the same transaction.

## Rationale

- `docs/product/mvp.md` places **Lifecycle transitions** under Nova Operations, and every shipped transition (propose, approve, activate, pause, resume) is a single-actor Nova action behind a confirmation panel — a dual-approval or pending-termination state would be a new lifecycle concept invented for one transition.
- The permission registry has stated the division of authority since Story 5.7: shelters *document circumstances* through case notes or incidents; Nova *acts*. Story 5.11 built exactly that pathway, including the immediate urgent-queue alert for Serious/Emergency reports.
- The program-owns-termination model matches the transitional-employment field norm: in the Center for Employment Opportunities model (OPRE Report 2011-18, MDRC/Vera for HHS-ACF), work-site supervisors are **program staff** who "identify individuals who may require disciplinary action," with CEO operating "as a managing agent for its work crews" — host sites are customers of the program, not the participant's disciplinary authority.
- A shelter can always control its own site in an emergency (asking someone to leave the premises is not a system action); what this ADR allocates is who records the *program-level* outcome and owns the decision. Pause (5.7) remains available when circumstances are temporary.

## Consequences

- Story 5.8 is Ready for Development: four terminal transitions under two permissions (`placement.complete` for the three standard outcomes, `placement.terminate` for Terminated), both granted to Program Coordinator and Nova Administrator only.
- Termination of a subsidized placement may constitute an employment action for a transitional worker. Before real participants are enrolled, Washington employment counsel must review: at-will status of transitional workers, wrongful-termination and discrimination exposure, final-pay timing obligations (RCW 49.48 — payroll workflows are outside this app per `docs/planning/assumptions.md`), and documentation standards for grant compliance (2 CFR 200 record retention). Added to the launch checklist.
- Participant-facing copy for Withdrawn and Terminated stays respectful and non-punitive per `docs/ux/content-style-guide.md` — the participant's My Placement view states the placement ended and directs them to their coordinator; reason categories and notes are internal.
- If counsel review or program experience later requires a second approver or a formal shelter request object, that arrives as a new ADR superseding this one; the single-actor mechanics ship now because they are the smallest faithful implementation of the documented authority model.

This decision is binding for MVP scope; deviations require updating this ADR.
