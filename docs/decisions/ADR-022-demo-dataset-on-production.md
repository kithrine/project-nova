# ADR-022: Demo-day dataset and shared demo accounts on production

## Status

Accepted (scoped exception to ADR-006; demo-day window 2026-07)

## Context

The capstone demo day publishes shared credentials so attendees can explore each
role's dashboard on the public production URL (project-nova.app). ADR-006 restricts
fixtures and seeds to the shared nonproduction stack; attendees, however, cannot
reach nonproduction (previews are protection-gated), and the showcase site links to
the production domain.

## Decision

Seed a clearly-bounded, fictional demo dataset on production via
`prisma/demo-seed.mts`, as a deliberate, Kit-approved exception to ADR-006:

- **Five sign-in accounts** (`participant|ops|shelter|grants|admin@project-nova.app`)
  with one shared password, provisioned in the production Clerk instance (password
  first factor enabled for demo day).
- **An isolated demo universe**: `demo_org_nova` (NOVA), `demo_org_shelter` /
  `demo_org_shelter2` (HOST) plus sites; every demo membership, person,
  application, placement, timesheet, funding row, incident, and audit row carries
  the `demo_` id prefix and `isSynthetic: true` where the model supports it.
- **Scope facts** (verified in code): shelter queries are host-org-scoped, so the
  shelter login sees only demo records. Nova-side queries are permission-gated but
  not org-partitioned (single-program design), so demo ops/grants/admin see
  whatever else production holds — a pre-run census of non-synthetic rows is
  reported to Kit for explicit go/no-go before seeding, and real staff will see
  demo rows in their queues for the demo window.
- **Reset semantics**: re-running the seed is the reset button — it restores
  canonical statuses, removes derivative rows attendee actions created, and
  re-forces the Clerk passwords (an attendee changing a password is undone).
- **Cleanup path**: after demo day, one cleanup pass deletes `demo_`-prefixed /
  synthetic rows and the five Clerk users. This is fictional data; ADR-021's
  counsel-gated deletion rules govern participant data and do not apply.

## Consequences

- Attendees experience every role on the real product at the real URL.
- Production temporarily contains labeled fictional records visible to real staff.
- The seed script lives in the repo (`prisma/demo-seed.mts`) behind a
  `DEMO_SEED_CONFIRM=yes` guard; operational steps in `docs/ops/demo-day.md`.
