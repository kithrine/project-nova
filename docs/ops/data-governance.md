# Data Governance

## Principles

- Collect only necessary data.
- Restrict sensitive data by role and scope.
- Preserve history.
- Audit sensitive access and exports.
- Separate production from nonproduction.
- Use synthetic data in testing.

## Retention

Working schedule (`ADR-021`, provisional pending Colorado-counsel review — a launch gate): all program records are retained at least **5 years after the related placement or enrollment ends** (Colorado work-record driver) or **3 years after the final financial report of any funding award they support** (2 CFR 200.334), whichever is later, extended automatically during any audit, charge, or litigation. Audit events are never deleted. MVP implements **no deletion paths**: records must not be permanently deleted through ordinary workflows, and any future deletion capability requires counsel review, FCRA-secure disposal (16 CFR 682) for consumer-report-derived records, and a superseding ADR.

## Exports

Only named exports with approved field allow-lists are permitted (Story 7.5). Exports are **ephemeral** (`ADR-021`): generated on demand and streamed, never stored — the audit event (actor, export name, scope, timestamp) is the durable record of every export.
