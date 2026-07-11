# Project Nova Architecture

## Style

A modular full-stack Next.js application with explicit domain boundaries.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- DaisyUI
- Native CSS / CSS Modules
- Clerk
- Prisma
- Neon PostgreSQL
- Vercel
- GitHub Actions
- Vitest
- React Testing Library
- Playwright

## Layers

1. Presentation
2. Server boundary
3. Application services
4. Domain policies
5. Repositories
6. Prisma and PostgreSQL

## Key principles

- Server Components by default
- Server Actions for first-party mutations
- Route Handlers for webhooks, uploads, downloads, exports, and integrations
- No business logic in components
- No raw Prisma records returned to the UI
- Role-shaped view models
- Transactions for critical operations
- Lifecycle events and audit events are distinct
- Sensitive data is loaded through restricted queries
