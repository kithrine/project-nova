# ADR-017 — Portable training readiness and site-specific competency

## Status

Accepted. Adopted for Story 3.4 on 2026-07-12. The legal allocation of
employer/host safety duties remains a launch-validation item. Research basis:
`docs/planning/policy-research-epic-3.md`.

## Decision

Project Nova uses a **three-program, two-layer training policy** for MVP.
Portable pre-matching training and host-site onboarding are distinct records,
gates, and claims about what a participant may safely do.

### Layer 1 — portable pre-matching training (Story 3.4)

The default `NOVA-TE` Program requires all three Training Programs before an
enrollment can become Ready for Matching:

1. **Workplace Readiness and Communication** — attendance and timekeeping,
   workplace communication, receiving feedback, conflict and escalation,
   worker responsibilities, digital navigation, and requesting support.
2. **Animal Behavior, Humane Handling, and Bite Prevention Foundations** —
   canine/feline body language, fear and stress signals, objective observation,
   low-stress handling concepts, bite/scratch prevention, and stop-and-get-help
   boundaries.
3. **Shelter Sanitation, Zoonoses, and PPE Foundations** — hand hygiene,
   cleaning versus disinfection, zoonotic-risk awareness, PPE concepts,
   chemical-label/SDS awareness, exposure reporting, and injury reporting.

These are program-scoped seeded reference data. Requiredness belongs to the
Program's training catalog, not an individual's Training Enrollment, so a
missing required program is detectable before an enrollment attempt exists.
Catalog authoring is outside Story 3.4.

Layer 1 is foundational and portable. It does not certify a participant to
handle every animal, chemical, tool, or task and must never be presented as
satisfying workplace-specific safety training.

### Layer 2 — host-site onboarding and competency (Story 5.4)

After a specific placement is known and before activation, the host provides
and documents the site-specific layer: the site's Accident Prevention Program
orientation, exits/emergencies, actual chemicals and SDS access, site PPE,
local sanitation SOPs/equipment, assigned-task animal-handling instruction,
task restrictions, and supervisor observation/signoff where proficiency is
required. Nova records host confirmation in Placement-owned onboarding history.

Layer 2 remains independently unsatisfied even when every Story 3.4 Training
Enrollment is complete. Host onboarding likewise does not replace Layer 1.

### Credentials remain separate (Story 3.5)

Issuer-backed or expiring credentials, such as CPR/First Aid or a third-party
animal-care certificate, are Certification records when issuer, identifier,
issue date, or expiration matters.

### Training Enrollment lifecycle

A Training Enrollment is one attempt by one Program Enrollment to complete one
Training Program:

```text
ENROLLED → IN_PROGRESS → COMPLETED
    ├──────────────────→ COMPLETED
    └──────────────────→ WITHDRAWN
IN_PROGRESS ───────────→ WITHDRAWN
```

- `ENROLLED → COMPLETED` supports verified prior learning or external/provider
  completion.
- `COMPLETED` and `WITHDRAWN` are terminal for that attempt. A later attempt is
  a new record.
- At most one `ENROLLED` or `IN_PROGRESS` attempt may exist for the same Program
  Enrollment and Training Program.
- Creation and every transition append an event in the same transaction as the
  current-state write.
- Actions record `enrolledAt`, `startedAt`, `completedAt`, or `withdrawnAt`.
  `expectedCompletionDate` is optional planning information, not lifecycle.
- The UI exposes explicit Enroll, Start, Complete, and Withdraw actions — never
  an arbitrary status dropdown.

### Completion evidence

`COMPLETED` means more than attendance. The coordinator records exactly one:

- knowledge assessment passed;
- provider completion verified;
- competency observed; or
- prior learning verified.

The verifier and verification time are recorded. Story 3.4 does not store
assessment answers, medical information, restricted history, or sensitive
narratives. For physical shelter tasks, the Layer 2 supervisor signoff remains
the controlling proficiency record.

### Readiness and participant visibility

- Story 3.6 treats each required catalog program with no `COMPLETED` attempt as
  an outstanding blocker. Withdrawn attempts remain history and do not satisfy
  the requirement.
- After onboarding, the participant-safe journey shows **Training** while any
  required portable program is outstanding, without provider/evidence details.
- Optional future modules are not universal blockers unless explicitly
  configured as required for a Program.

## Rationale

Reentry models pair concise job-readiness preparation with paid work-based
learning. Animal-shelter guidance requires task-specific instruction and
demonstrated skill before proficiency is assumed. Washington safety rules
require orientation to the actual workplace, assignment, PPE, emergencies, and
hazards. A portable-only gate overstates what was verified; a site-only gate
delays common preparation and makes matching readiness inconsistent.

The two-layer model preserves domain boundaries: Program Enrollment owns
preparation for matching; Placement owns preparation for a particular worksite.
Structured evidence prevents attendance from being mistaken for proficiency.

## Consequences

Story 3.4 adds program-scoped Training Program catalog rows, Training Enrollment
attempts, append-only events, permissions, and Operations UI. Story 3.6 consumes
catalog requiredness and completed attempts. Story 5.4 captures the independent
site gate. Story 3.5 remains the credential system.

Washington counsel or the employer-of-record partner must validate whether and
how Chapter 296-801 WAC applies to Nova's exact arrangement before pilot launch.
That may refine contracts or retention, but not this product boundary.

This decision is binding for MVP. Changes to the three universal programs, the
two-layer gate, evidence rule, or lifecycle require a superseding ADR.
