# RULES.md — Non-Negotiable Project Rules

## Always

- Use TypeScript strict mode.
- Validate all server-bound input.
- Enforce authorization server-side.
- Use semantic HTML before ARIA.
- Preserve lifecycle history.
- Use transactions for critical transitions.
- Write audit events for sensitive actions.
- Use decimal types for money and hours.
- Use accessible labels, focus states, and error messages.
- Design UI mobile-first, then progressively enhance for larger screens. The information-dense Operations experience stays desktop-optimized but is still built from the mobile-first baseline.
- Keep development, preview, and production secrets separate.
- Use `prisma migrate dev` locally and `prisma migrate deploy` in deployment workflows.
- Use Tailwind by default and native CSS when it is the clearer or stronger solution.
- Add tests for business rules and authorization boundaries.
- Use respectful, plain language in participant-facing copy.
- Update all affected documentation in the same change set as the behavior change (see Documentation synchronization).
- Follow the branch-per-story git workflow in `docs/architecture/git-workflow.md` (one branch and pull request per story, squash-merged).
- Ask clarifying questions when requirements, business rules, lifecycle behavior, or acceptance criteria are unclear; do not assume unstated behavior.

## Never

- Put business logic in React components.
- Query Prisma from client components.
- Trust client-supplied authorization claims.
- Hardcode role checks such as `isAdmin`.
- Allow arbitrary lifecycle status dropdowns.
- Return raw Prisma entities to the UI.
- Expose background details to shelters.
- Expose internal case notes to participants or shelters.
- Hard delete applications, placements, timesheets, incidents, or audit events through normal workflows.
- Manually edit the production schema.
- Commit secrets.
- Log sensitive record contents.
- Use floating-point types for wages.
- Add blended funding to MVP.
- Build a generic workflow engine, chat platform, or marketplace in MVP.
- Treat form submission as emergency response.
- Invent business rules, eligibility criteria, funding logic, or retention periods — ask instead.

## Change control

A change affecting the stack, domain boundaries, data privacy, lifecycle transitions, or authorization model requires an ADR in `docs/decisions/`.

## Documentation synchronization

When behavior changes, the corresponding documentation must be updated in the **same change set** as the implementation. This applies to product docs, architecture docs, UX docs, stories, terminology, and any affected ADRs.

- A task is not complete while its documentation is outdated.
- Documentation and implementation ship together; never defer a doc update to a follow-up change.
- A pull request that changes behavior without the matching documentation update is not ready to merge.
