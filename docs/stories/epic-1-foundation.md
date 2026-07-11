# Epic 1 — Platform Foundation

## Goal
Create the secure technical foundation.

## Stories

| ID | Story | Status |
|---|---|---|
| 1.1 | Initialize Next.js and design tokens | Done |
| 1.2 | Configure Clerk | Done |
| 1.3 | Configure Neon and Prisma | Done |
| 1.4 | Create user and organization membership models | Done |
| 1.5 | Build authorization context | Done |
| 1.6 | Configure CI and tests | Ready for Development |
| 1.7 | Create role-specific protected layouts | Ready for Development |
| 1.8 | Manage funding sources | Ready for Development |

> Sequencing note: the epic is numbered 1.1–1.8 for reference, but the safe build order is 1.1 → 1.3 → 1.4 → 1.2 → 1.5 → 1.6 → 1.7, with 1.8 (funding-source reference data) buildable any time after 1.5 and required before Epic 5's Story 5.3. The Clerk user-provisioning write (1.2) depends on the `User` model (1.4); see each story's Dependencies.

---

## Story 1.1 — Initialize Next.js and design tokens

### Status
Done

### User story
As a Nova engineer, I want an initialized Next.js App Router project with the approved toolchain and base design tokens, so that every later feature is built on a consistent, type-safe, mobile-first foundation.

### Scope
- Initialize Next.js (App Router) with TypeScript in strict mode.
- Configure Tailwind CSS and DaisyUI; enable native CSS, CSS Modules, and CSS variables as first-class options.
- Create the `src/` structure from `docs/architecture/folder-structure.md`: route groups `(public)`, `(participant)`, `(shelter)`, `(operations)`, and `api/`; plus `components/`, `features/`, `server/`, `lib/`, `styles/`, `types/`, and top-level `prisma/`, `tests/`, `docs/`.
- Define base design tokens as CSS variables: neutral-first surfaces, deep blue primary, muted teal accent, calm green success, amber warning, muted red danger, spacing scale, moderate radii, and a readable sans-serif (such as Inter). Structure tokens so a future dark theme is possible without building it now.
- Establish a mobile-first global stylesheet and responsive baseline.
- Configure ESLint and Prettier.

### Acceptance criteria
1. Given a clean checkout, when a developer runs the documented install and dev commands, then the app starts locally with no type or lint errors.
2. Given the app shell, when it renders, then design tokens are available as CSS variables and applied through the Tailwind theme and/or `:root`.
3. Given any starter page, when viewed first at a 360px viewport and then enlarged, then the layout is mobile-first and progressively enhances with no horizontal scroll.
4. Given the repository, when inspected, then the folder structure matches `docs/architecture/folder-structure.md`.
5. Given TypeScript, when the project builds, then strict mode is enabled and there are no unexplained `any` types.

### Authorization
None. Only the `(public)` route group exists at this stage; no authenticated surfaces.

### Lifecycle rules
None.

### Data changes
None. No database models are introduced in this story.

### UX and accessibility
- Establish a semantic HTML baseline, visible focus styles, and `prefers-reduced-motion` support in global styles.
- Tokens must support AA contrast; status is never conveyed by color alone.
- Icons are SVG only — no emojis (see `docs/ux/component-guidelines.md`).

### Tests
- Unit: token/theme configuration resolves the expected values.
- Integration: not applicable (no data layer yet).
- Component: a base primitive (e.g., Button) renders its variants and shows an accessible focus state.
- E2E: the app boots and the public landing route returns 200 in a Playwright smoke test.

### Out of scope
Authentication, database, protected layouts, the full component library, and dark theme implementation (later stories/epics).

### Dependencies
None. This is the first story.

---

## Story 1.2 — Configure Clerk

### Status
Done

### User story
As a Nova engineer, I want Clerk authentication wired into the app with a verified user-provisioning webhook, so that people can sign in securely and each Clerk identity maps to an internal Nova `User` record.

### Scope
- Configure Clerk for the Next.js App Router: middleware, sign-in / sign-up, sessions, and email verification.
- Provide separate Clerk credentials for development, preview, and production.
- Implement a Route Handler for the Clerk webhook that verifies the signature and provisions or updates the internal `User` record idempotently.
- Authentication only; authorization is Story 1.5.

### Acceptance criteria
1. Given an unauthenticated visitor, when they request a protected route, then they are redirected to sign in.
2. Given a new Clerk user, when the verified webhook fires, then an internal `User` record is created with the Clerk user ID stored.
3. Given a duplicate or replayed webhook event, when processed, then handling is idempotent and no duplicate `User` is created.
4. Given an unsigned or invalidly signed webhook payload, when received, then it is rejected and nothing is written.
5. Given the three environments, when deployed, then each uses distinct Clerk credentials.

### Authorization
Authentication boundary only. Clerk authentication does not determine application authorization. The webhook endpoint trusts only verified signatures and never trusts unsigned payloads.

### Lifecycle rules
None. User provisioning is identity mapping, not a domain lifecycle.

### Data changes
Creates/updates `User` (`clerkUserId`, email, timestamps). Clerk tokens and secrets are never logged.

### UX and accessibility
Sign-in and sign-up pages use accessible labels, managed focus, and plain language; errors are announced to assistive technology.

### Tests
- Unit: webhook signature verification and idempotency-key logic.
- Integration: a verified webhook creates/updates exactly one `User`; unsigned payloads are rejected.
- Component: a protected page redirects unauthenticated users (or renders the sign-in entry point).
- E2E: a user can sign in and reach an authenticated placeholder page.

### Out of scope
Roles, permissions, memberships, and organization scoping (Stories 1.4 and 1.5).

### Dependencies
1.1. The user-provisioning write depends on the `User` model (1.4) and Prisma setup (1.3); until those land, provisioning may be stubbed, or 1.3/1.4 sequenced first.

---

## Story 1.3 — Configure Neon and Prisma

### Status
Done

### User story
As a Nova engineer, I want Prisma connected to a Neon PostgreSQL database with the migration workflow established, so that the app has a reliable, type-safe, versioned data layer.

### Scope
- Add Prisma and connect to the shared nonproduction Neon database for local and preview; configure production separately.
- Establish the migration workflow: `prisma migrate dev` locally, `prisma migrate deploy` in deployment.
- Add a health-check Route Handler that verifies database connectivity.
- Establish data conventions: `cuid()` internal IDs, `Decimal` for money and hours, `SCREAMING_SNAKE_CASE` enums, and archive-not-hard-delete for domain records.
- Add a seed script that uses synthetic data only.

### Acceptance criteria
1. Given local dev, when `prisma migrate dev` runs, then migrations apply to the shared nonproduction database with no manual schema edits.
2. Given the deployment workflow, when it runs, then `prisma migrate deploy` applies pending migrations.
3. Given the health-check endpoint, when called, then it reports database connectivity without exposing secrets.
4. Given the shared nonproduction database, when tests run, then they use unique run identifiers and targeted cleanup — no global truncation and no assumption the database is empty.
5. Given production, when configured, then it uses a separate Neon database and production data is never copied into nonproduction.

### Authorization
The health-check endpoint exposes no sensitive data.

### Lifecycle rules
None yet. This story establishes the archive-not-delete convention that later domain tables follow.

### Data changes
Introduces the Prisma schema baseline and migration history. Domain tables are added by later stories; a minimal baseline migration may be included.

### UX and accessibility
Not applicable.

### Tests
- Unit: money/hours `Decimal` helpers and the ID-generation convention.
- Integration: a migration applies cleanly; the health check reports healthy; the shared-database test-isolation helper creates and cleans up scoped data.
- Component: not applicable.
- E2E: the health-check route returns healthy in the Playwright smoke test.

### Out of scope
Domain models (1.4) and authorization (1.5).

### Dependencies
1.1.

---

## Story 1.4 — Create user and organization membership models

### Status
Done

### User story
As a Nova engineer, I want `User`, `Organization`, `Organization Site`, and `Membership` models with roles, so that identities map to organizations and role-scoped access can be enforced.

### Scope
- Define Prisma models: `User` (holds `clerkUserId`), `Organization` (host organizations and Nova), `OrganizationSite`, and `Membership` (user↔organization with role and active status), plus a `Role` enum.
- Roles: Participant, Shelter Supervisor, Shelter Manager, Program Coordinator, Grant Administrator, Nova Administrator, and the optional Restricted Review Specialist.
- Establish organization-scoping as a foundation for authorization.
- Create the migration via `prisma migrate dev`.

### Acceptance criteria
1. Given the schema, when migrated, then `User`, `Organization`, `OrganizationSite`, and `Membership` tables exist with a `Role` enum in `SCREAMING_SNAKE_CASE`.
2. Given a user who belongs to an organization, when represented, then a `Membership` records the role and active status.
3. Given a membership set to inactive, when read, then it is preserved (not deleted) and no longer grants access.
4. Given data access, when models are read above the data layer, then repositories return shaped types, not raw Prisma records.
5. Given the seed script, when run, then synthetic users, organizations, and memberships exist for each role.

### Authorization
Provides the data that authorization (1.5) consumes — internal user, active membership, and role. No runtime checks are enforced here beyond schema constraints.

### Lifecycle rules
Membership status changes are reversible and historical; memberships are never hard-deleted.

### Data changes
Adds `User`, `Organization`, `OrganizationSite`, `Membership`, and the `Role` enum.

### UX and accessibility
Not applicable.

### Tests
- Unit: role enum mapping and view-model shaping for user/membership.
- Integration: membership uniqueness and organization-scope constraints; inactive membership is retained; a scoped query returns only in-scope rows.
- Component: not applicable.
- E2E: covered indirectly through protected layouts (1.7).

### Out of scope
Permission definitions and the authorization evaluation (1.5); shelter onboarding workflows (Epic 5 / ops).

### Dependencies
1.3. Enables 1.2 (user-provisioning write) and 1.5 (authorization).

---

## Story 1.5 — Build authorization context

### Status
Done

### User story
As a Nova engineer, I want a server-side authorization context and helpers that implement `Authorization = Permission + Resource Scope + Lifecycle State`, so that every protected operation is checked consistently and the client is never trusted.

### Scope
- Define permissions as `resource.action` codes in TypeScript, with role→permission mappings.
- Implement the authorization evaluation sequence: authenticate → resolve internal user → resolve memberships → check permission → load resource → check scope → check lifecycle → check prerequisites.
- Provide server-side guards/helpers usable by Server Actions, Route Handlers, and application services, returning typed authorization errors.
- Never trust client-supplied user IDs, roles, organization IDs, or permissions.

### Acceptance criteria
1. Given a request without authentication, when a guarded operation runs, then it fails with an Authentication error.
2. Given an authenticated user lacking the required permission, when they attempt an action, then it fails with an Authorization error.
3. Given a user who has the permission but is outside the resource's organization scope, when they attempt the action, then it is denied.
4. Given a resource in a disallowed lifecycle state, when a state-gated action is attempted, then it is denied even though permission and scope pass.
5. Given client-supplied role/organization/permission claims, when received, then they are ignored in favor of server-resolved data.

### Authorization
This story is the authorization core. It is server-side only and must be fully covered by tests; it defaults to deny.

### Lifecycle rules
Introduces lifecycle-state checks as a first-class authorization input, consumed by later domain stories.

### Data changes
None. It reads `User` and `Membership`; permission maps live in code.

### UX and accessibility
Authorization failures surface as the Permission denied / Restricted screen states (see `docs/ux/wireframe-spec.md`), never as stack traces or secrets.

### Tests
- Unit: permission resolution per role; each step of the evaluation sequence; deny-by-default behavior.
- Integration: scope checks against real memberships; lifecycle gating with a sample resource.
- Component: a guarded server component/action renders the Permission denied state when unauthorized.
- E2E: cross-organization access is denied (a shelter user cannot reach another organization's resource).

### Out of scope
Domain-specific permissions for later epics (added with their features) and runtime-configurable permissions (future).

### Dependencies
1.2 (authentication) and 1.4 (users, memberships, roles).

---

## Story 1.6 — Configure CI and tests

### Status
Ready for Development

### User story
As a Nova engineer, I want CI running the full quality pipeline with the test toolchain configured, so that every pull request is verified before merge and `main` stays deployable.

### Scope
- Configure Vitest, React Testing Library, and Playwright.
- Build the GitHub Actions PR pipeline: install → lint → type check → validate Prisma schema → unit tests → component tests → build → Vercel preview → Playwright smoke tests → require checks before merge.
- Configure branch protection: pull request required, required checks must pass, no direct push to `main`, no unresolved migration failures, and preview review before a production merge.

### Acceptance criteria
1. Given a pull request, when opened, then the pipeline runs all ten steps in order and reports status.
2. Given a failing lint, type, schema, unit, component, build, or smoke step, when it fails, then the pull request is blocked from merge.
3. Given `main`, when a developer attempts a direct push, then branch protection rejects it.
4. Given a migration failure, when detected in CI, then the pipeline fails.
5. Given a preview deployment, when created, then Playwright smoke tests run against it.

### Authorization
Not applicable (tooling). CI secrets are environment-separated and never logged.

### Lifecycle rules
None.

### Data changes
None. Tests use synthetic data with the isolation helpers from 1.3.

### UX and accessibility
Include an automated accessibility check in the component/E2E stage as a baseline gate.

### Tests
- Unit: an example unit test runs in CI.
- Integration: an example integration test runs against the shared nonproduction database with isolation.
- Component: an example React Testing Library test includes an accessibility assertion.
- E2E: a Playwright smoke test (app boots, health check, sign-in) runs against the preview.

### Out of scope
Full end-to-end journey coverage (built per epic) and performance testing.

### Dependencies
1.1; benefits from 1.3 (database for integration tests).

---

## Story 1.7 — Create role-specific protected layouts

### Status
Ready for Development

### User story
As a Nova engineer, I want role-specific protected layouts for the participant, shelter, and operations route groups, so that each experience has the correct navigation, access gating, and shell.

### Scope
- Implement layouts for the `(participant)`, `(shelter)`, and `(operations)` route groups; keep `(public)` open.
- Each protected layout enforces authentication, an internal user, and active membership via the 1.5 authorization context: operations requires Nova membership and permissions; shelter requires active shelter membership; participant requires a linked participant identity where applicable.
- Provide per-experience navigation from `docs/ux/information-architecture.md`, mobile-first, with SVG icons (no emojis).
- Render the Permission denied / Restricted states appropriately.

### Acceptance criteria
1. Given an operations route, when accessed by a non-Nova user, then access is denied with the Permission denied state.
2. Given a shelter route, when accessed by a user without active shelter membership, then access is denied.
3. Given each experience, when rendered, then navigation matches `docs/ux/information-architecture.md` for that role.
4. Given a mobile viewport, when a protected layout renders, then navigation is mobile-first (e.g., collapsible) and the primary action is reachable.
5. Given any icon in the shell, when inspected, then it is an SVG (no emoji) with an accessible label or marked decorative.

### Authorization
Uses the 1.5 authorization context to enforce authentication + internal user + active membership + role scope at the layout boundary. The client is never trusted.

### Lifecycle rules
None directly; these layouts host the lifecycle and blocker components introduced in later epics.

### Data changes
None.

### UX and accessibility
Semantic landmarks (`nav`, `main`, `header`), keyboard-navigable navigation, visible focus, logical tab order, screen-reader route announcements, and mobile-first responsive navigation.

### Tests
- Unit: the navigation model per role.
- Integration: a layout denies out-of-scope memberships.
- Component: each layout renders the correct navigation and the denied/restricted states, with keyboard-navigation and accessibility checks.
- E2E: a participant, a shelter user, and an operations user each land on their correct shell; cross-experience access is denied.

### Out of scope
The feature pages inside each layout (later epics) and public marketing content (Epic 2).

### Dependencies
1.1 and 1.5; information architecture from `docs/ux/information-architecture.md`.

---

## Story 1.8 — Manage funding sources

### Status
Ready for Development

### User story
As a Grant Administrator, I want to create and manage funding sources, so that placements can be funded and hours can be reported against the correct grant.

### Scope
- Define the `FundingSource` model as Nova-owned reference data: name, kind (grant / contract / other), a human-readable code or identifier, status (`ACTIVE` / `INACTIVE`), optional start and end dates, and optional notes.
- Provide Operations administration CRUD (create, edit, deactivate) under Operations → Administration (`docs/ux/information-architecture.md`), restricted to Grant Administrator and Nova Administrator.
- Deactivation archives a funding source (never a hard delete), preserving history and any existing funding assignments.
- This story establishes the master records that Story 5.3 (Assign funding) attaches to a placement and Story 7.2 (Approved hours by funding source) reports on. In MVP a placement has exactly one active funding assignment (`docs/decisions/ADR-010-funding.md`).

### Acceptance criteria
1. Given a Grant Administrator with the funding-management permission, when they create a funding source with a name and required fields, then it is saved and becomes available to assign to placements.
2. Given an existing funding source, when its details are edited, then the change is recorded and reflected wherever the source is referenced.
3. Given a funding source assigned to one or more placements, when an administrator deactivates it, then it is archived (not hard-deleted) and is no longer selectable for new assignments, while existing assignments and historical reporting remain intact.
4. Given a user without the funding-management permission (for example, a Program Coordinator or any shelter role), when they attempt to create or edit a funding source, then it is denied with the Permission denied state.
5. Given the funding sources list, when requested, then only Nova Operations roles with the permission can see it — no shelter or participant access.

### Authorization
A `funding.manage` permission granted to Grant Administrator and Nova Administrator, Nova organization scope. Server-side only; role-shaped view models. Funding sources are never exposed to shelters or participants.

### Lifecycle rules
`FundingSource` status (`ACTIVE` / `INACTIVE`) is reversible and historical; a funding source is never hard-deleted because funding assignments and funding reports depend on it.

### Data changes
Adds `FundingSource` (`id` [`cuid`], `name`, `kind`, `code`, `status`, `startDate`, `endDate`, `notes`, timestamps). No monetary amounts are stored here — allocation amounts and blended funding are out of MVP scope (`docs/decisions/ADR-010-funding.md`).

### UX and accessibility
Operations Administration list and form; accessible labels above inputs with programmatic error association; status shown as text (`Active` / `Inactive`), never color alone; SVG-only icons; mobile-first layout; Loading, Empty, Error, and Permission denied states (`docs/ux/wireframe-spec.md`).

### Tests
- Unit: funding-source validation and active/inactive status logic.
- Integration: create/edit/deactivate persistence; archive-not-delete preserves existing assignments; permission and Nova-scope enforcement.
- Component: the admin list and form render their states with accessible errors.
- E2E: a Grant Administrator creates a funding source that then becomes selectable when assigning funding to a placement (Story 5.3).

### Out of scope
Funding amounts and allocations, blended or multi-source funding (deferred, `docs/decisions/ADR-010-funding.md`), reimbursement packets, and a funder portal (V3). Assigning a funding source to a placement (Story 5.3).

### Dependencies
1.4 (roles and memberships), 1.5 (authorization context), 1.7 (Operations protected layout). Enables Story 5.3 (Assign funding) and Story 7.2 (Approved hours by funding source).
