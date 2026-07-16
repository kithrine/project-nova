# Environments

## Local development

- `localhost`
- Local environment variables
- Clerk development instance
- Shared nonproduction Neon database
- Test storage
- Seeded synthetic data

## Preview

- Vercel preview URL per pull request
- Nonproduction Clerk credentials
- Shared nonproduction Neon database
- No production PII
- Playwright smoke tests

## Production

- Production branch: `main`
- Production Clerk instance
- Production Neon database
- Production storage
- Custom domain
- Protected deployment process

> **Launched (2026-07-15, Story 7.9):** production is live at
> **`https://project-nova.app`** (`www` 308-redirects to the apex) on
> its own Clerk production instance (email code + custom Google OAuth),
> its own Neon database (migrations applied by
> `.github/workflows/deploy-migrations.yml` on every push to `main`),
> and its own Blob store. Vercel Deployment Protection is **enabled**:
> preview URLs require Vercel SSO, and CI's preview smoke tests
> authenticate with the Protection Bypass for Automation secret
> (`VERCEL_AUTOMATION_BYPASS_SECRET`). The production database holds
> real data — fixtures, seeds, and tests must only ever target the
> shared nonproduction stack above (ADR-006). The guided procedure that
> produced this state is `docs/ops/launch-runbook.md`.

## Staging

Deferred until a stable shared preproduction environment is operationally necessary.
