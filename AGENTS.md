# AGENTS.md — Project Nova Agent Handbook

## Purpose

This file tells AI coding agents how to work safely and consistently in Project Nova.

## Read before coding

Agents must review:

1. `PROJECT_CONTEXT.md`
2. `RULES.md`
3. `docs/product/prd.md`
4. `docs/architecture/architecture.md`
5. The relevant domain document and story
6. `docs/architecture/git-workflow.md`

## Project identity

Project Nova is not a generic job board, shelter CRM, or staffing marketplace. It is a workforce case-management platform for transitional employment programs. The participant journey is the mission center; Placement is the operational center.

## Required stack

- Next.js App Router
- React
- TypeScript in strict mode
- Tailwind CSS
- DaisyUI where useful
- Native CSS / CSS Modules when appropriate
- PostgreSQL via Neon
- Prisma
- Clerk
- Vercel
- GitHub Actions
- Vitest + React Testing Library
- Playwright

Do not replace the stack without an approved ADR.

## Architecture rules

- Use Server Components by default.
- Use Client Components only for browser interaction.
- Use Server Actions for first-party mutations.
- Use Route Handlers for webhooks, exports, file workflows, integrations, and external access.
- Keep business logic in application services and domain policies.
- Keep Prisma access in repositories or server-side data modules.
- Return role-shaped view models, not raw Prisma records.
- Record lifecycle events and audit events where required.
- Use transactions for critical multi-record operations.

## Domain boundaries

Primary domains:

- Identity and organizations
- Applications
- Program enrollments
- Placement matching
- Placements
- Timesheets
- Evaluations
- Incidents
- Case notes
- Training and certifications
- Funding
- Documents
- Reporting
- Audit

Do not organize business logic around pages.

## Authorization

Every protected operation must evaluate:

1. Authentication
2. Internal Nova user
3. Active membership
4. Permission
5. Resource scope
6. Lifecycle state
7. Business prerequisites

Never trust user IDs, roles, organization IDs, or permissions sent by the client.

## Styling

Tailwind is the default utility framework. DaisyUI may supply primitives. Native CSS, CSS Modules, CSS variables, keyframes, container queries, and modern selectors are approved first-class tools.

Use native CSS when utility classes become awkward, obscure intent, or limit visual quality.

## Testing

Every critical business rule and high-risk journey requires automated coverage.

- Unit: domain policies, transitions, permissions, calculations
- Component: visible behavior and accessibility
- Integration: Prisma transactions and constraints
- E2E: participant, operations, shelter, and security workflows

## Sensitive data

Never expose or log:

- Background report contents
- Criminal-history details
- Internal case notes
- Serious incident narratives
- Government identifiers
- Clerk tokens
- Database secrets
- Uploaded document contents

## Working style

- Follow the branch-per-story git workflow in `docs/architecture/git-workflow.md`.
- Make the smallest coherent change.
- Preserve approved terminology.
- Update documentation when behavior changes.
- Add or update tests before declaring completion.
- Do not invent business rules.
- Flag unresolved legal, grant, payroll, and retention requirements.
