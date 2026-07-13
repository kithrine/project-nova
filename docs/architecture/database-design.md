# Database Design

## Database

PostgreSQL hosted by Neon and accessed through Prisma.

## Identifier strategy

- Internal IDs: `cuid()`
- Human references: generated application, placement, and incident numbers

## Important constraints

- One active placement per participant through a partial unique index
- One active funding assignment per placement through a partial unique index
- XOR ownership checks for case notes and onboarding tasks
- Exactly one owning context for each document (Application XOR Certification since Story 3.5, via CHECK constraint)
- Money stored as Decimal
- Historical records archived, not deleted

## Lifecycle events

Status transitions on workflow records write an append-only lifecycle event
row (from-status, to-status, actor, timestamp) in the same transaction as the
status change, so no partial transition can exist. `ApplicationEvent`
(Story 2.5) is the first of these; later workflow tables follow the same
pattern. Lifecycle events are distinct from audit events
(`docs/architecture/architecture.md`) and are never updated or deleted.

## Audit events

Access to restricted content writes an append-only `AuditEvent` row (actor,
permission-style action code, subject reference, timestamp) in the same
request that delivers the content — first use: reads of restricted
background-review content (Story 2.7). The audit record itself carries no
sensitive content, so the trail is safe to review.

## Migration strategy

- Local: `prisma migrate dev`
- CI/production: `prisma migrate deploy`
- Prefer backward-compatible expand/migrate/contract changes
- Never edit production schema manually

## Shared nonproduction database

Local and preview use one shared nonproduction Neon database.

Guardrails:

- Unique test-run identifiers
- Targeted cleanup only
- No global truncation
- No assumption that the database is empty
- Production data never copied into nonproduction
