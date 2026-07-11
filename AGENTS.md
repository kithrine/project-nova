# AGENTS.md — Project Nova Agent Handbook

## Purpose

This file tells AI coding agents how to work safely, consistently, and productively in Project Nova. Read it before every task. When it conflicts with a direct user instruction, follow the user; when it conflicts with another doc, follow the more specific doc and flag the conflict.

## Read before coding

Before touching code for a story, review:

1. `PROJECT_CONTEXT.md` — mission, users, design principles
2. `RULES.md` — non-negotiable rules
3. `TERMINOLOGY.md` — canonical vocabulary
4. `docs/product/prd.md` — product scope and non-goals
5. `docs/architecture/architecture.md` — layers and boundaries
6. The story itself (`docs/stories/epic-*.md`) and every doc it links
7. `docs/architecture/git-workflow.md` — branch-per-story workflow
8. `docs/stories/user-story-template.md` and `.github/pull_request_template.md`

## Project identity

Project Nova is not a generic job board, shelter CRM, or staffing marketplace. It is a workforce case-management platform for transitional employment programs. The participant journey is the mission center; Placement is the operational center. Behind every record is a real person re-entering the workforce and a real animal-shelter partner — correctness, privacy, and respect matter more than speed.

## How to work a story

1. **Read** the story and every doc it references. Make sure you understand its acceptance criteria, authorization, lifecycle rules, and data changes.
2. **Ask if unclear.** If any requirement, business rule, lifecycle transition, or acceptance criterion is ambiguous or missing, ask before coding (see "Ask, don't assume"). Do not start on guesses.
3. **Branch** per `docs/architecture/git-workflow.md` (`story/<epic>.<story>-<slug>`).
4. **Write tests first** for the business rules and authorization named in the acceptance criteria (`docs/architecture/testing-strategy.md`).
5. **Implement in layers**, presentation last: repository → domain policy → application service → Server Action / Route Handler → Server/Client Component. Keep business logic out of components and actions.
6. **Enforce authorization server-side** on every protected operation (see Authorization below).
7. **Sync documentation** in the same change (`RULES.md` → Documentation synchronization) and update the story's Status.
8. **Verify** (see "Verify before you claim done"): lint, type-check, and the relevant test layers pass, and the acceptance criteria actually hold.
9. **Open a PR** using `.github/pull_request_template.md`; fill the acceptance-criteria and documentation-synchronization checkboxes honestly.

## Definition of done

A story is done only when all of the following hold:

- Every acceptance criterion is met and demonstrated.
- Authorization is enforced server-side (permission + resource scope + lifecycle state) and covered by tests.
- The relevant test layers (unit / integration / component / e2e) are added and passing.
- All affected documentation is updated in the same change set.
- Accessibility holds: mobile-first, semantic HTML, visible focus, keyboard-operable, no color-only status, SVG icons (no emoji), WCAG 2.2 AA.
- No sensitive data is exposed to the wrong role or written to logs.
- The PR checklist is complete and required checks pass.

Do not mark a story done, or claim a task complete, before this bar is met.

## Ask, don't assume

When a requirement, business rule, lifecycle transition, acceptance criterion, permission, or data shape is unclear, missing, or contradictory — **stop and ask a specific question.** Do not fill the gap with a plausible guess.

- Never invent business rules, eligibility or screening criteria, funding logic, permission mappings, or retention periods.
- A wrong assumption here is not a harmless bug: it can deny someone a placement, expose restricted data, or breach grant or employment terms.
- Prefer one precise question over three assumptions. Cite the story and the exact ambiguity.
- If only part of a story is unclear, build the clear part and ask about the rest rather than blocking the whole thing.

## Handling blocked and unresolved items

Some stories are marked **Blocked — pending policy validation** (currently 2.8, 2.10, 2.11, 5.8, 5.10, 7.2, 7.5). For these:

- Build the unambiguous mechanism (the workflow shell, the data model, the non-policy logic).
- Stub the policy-dependent part behind a clear `TODO` that names the open question; do not hard-code a guessed policy.
- Surface the open item, and log any newly discovered legal, grant, payroll, or retention question in `docs/planning/open-questions.md` (the current register).

## Verify before you claim done

Evidence before assertions. Never state that a story is complete, a test passes, a build is green, or a bug is fixed without running the command and reading the output. If something fails or was skipped, say so plainly with the output — never soften it or assume success.

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

Authorization = **Permission + Resource Scope + Lifecycle State**. Every protected operation must evaluate, in order (see `docs/architecture/authorization-rbac.md`):

1. Authentication
2. Internal Nova user
3. Active membership
4. Permission
5. Resource scope
6. Lifecycle state
7. Business prerequisites

Never trust user IDs, roles, organization IDs, or permissions sent by the client.

## Styling

Tailwind is the default utility framework. DaisyUI may supply primitives. Native CSS, CSS Modules, CSS variables, keyframes, container queries, and modern selectors are approved first-class tools. Build mobile-first. Use SVG icons only — never emoji. Never convey status by color alone.

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
- Ask when unsure; never assume unstated behavior (see "Ask, don't assume").
- Preserve approved terminology (`TERMINOLOGY.md`).
- Update documentation when behavior changes.
- Add or update tests before declaring completion.
- Do not invent business rules.
- Flag unresolved legal, grant, payroll, and retention requirements in `docs/planning/open-questions.md`.
