# Project Nova — Project Context

## One-line definition

Project Nova is a workflow-driven workforce case-management platform for grant-funded transitional employment, beginning with placements at animal shelters.

## Mission

Project Nova helps people returning from incarceration enter paid, meaningful transitional work, gain credentials and experience, and progress toward sustainable employment.

## Operating model

- Project Nova, or an approved fiscal-sponsor/employer-of-record partner, employs participants.
- Shelters are host worksites, not the employer.
- Participants move through application, screening, onboarding, training, matching, placement, career transition, and completion.
- The operational center of the product is the **Placement**.
- The broader mission center is the participant’s journey toward sustainable employment.
- MVP funding uses one active funding source per placement.
- Blended funding is deferred to a later version.

## Primary users

- Participant / applicant
- Program Coordinator
- Shelter Supervisor
- Shelter Manager
- Grant Administrator
- Nova Administrator

## Product experiences

- Public website
- Participant experience
- Shelter partner experience
- Nova Operations experience

## Technology baseline

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- DaisyUI
- Native CSS and CSS Modules as first-class styling options
- PostgreSQL on Neon
- Prisma ORM and Prisma Migrate
- Clerk authentication
- Vercel hosting and preview deployments
- GitHub and GitHub Actions
- Vitest, React Testing Library, and Playwright

## Design principles

1. Never make the user wonder what to do next.
2. Show only the complexity needed for the current task.
3. Prefer workflow-first interfaces over menu-first interfaces.
4. Treat sensitive participant information as restricted by default.
5. Tailwind is the default, not a limitation.
6. Native CSS is explicitly allowed when it improves maintainability or visual quality.
7. Business logic never belongs in React components.
8. Authorization requires permission, resource scope, and lifecycle state.
