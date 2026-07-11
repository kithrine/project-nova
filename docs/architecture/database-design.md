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
- Exactly one owning context for each document
- Money stored as Decimal
- Historical records archived, not deleted

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
