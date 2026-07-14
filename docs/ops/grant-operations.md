# Grant Operations

## MVP

- Record funding source
- Assign one active source to each placement
- Track approved hours by funding source
- Export basic reimbursement-support reports
- Preserve audit history

## Deferred

- Blended allocations
- Cost-category allocation
- Automated reimbursement packets
- Funder portal
- Pay-for-success logic

## Open requirements

Exact grant fields and reporting formats must be validated against actual
awards. Until then, `ADR-020` adopts a provisional pilot format for the
approved-hours report (grouped by funding source; finalized `LOCKED` hours
distinguished from `APPROVED`-but-unlocked; hours only, no dollar math),
visibly flagged as provisional. Validating that format against each executed
award before any reimbursement use is a launch-checklist gate.
