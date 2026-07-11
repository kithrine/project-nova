# ADR-002-separate-lifecycles — Separate lifecycle objects

## Status
Accepted

## Decision
Keep Application, Program Enrollment, Placement Match, and Placement distinct.

## Rationale
Prevents pre-placement states from polluting placement data.

## Consequences
- This decision is binding for MVP.
- Changes require a superseding ADR.
