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

> **Pre-launch status (intentional):** the Vercel Production environment
> carries NO environment variables until launch (Story 7.9), so the
> production URL (`project-nova-lake.vercel.app`) returns
> `500 MIDDLEWARE_INVOCATION_FAILED` — Clerk's middleware cannot
> initialize without `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` /
> `CLERK_SECRET_KEY`. This is a known, deliberate condition, not an
> outage: a production Clerk instance requires the custom domain
> (Clerk production instances cannot run on `*.vercel.app`), so
> production configuration is inherently coupled to the 7.9 launch
> work (domain, production Clerk/Neon/Blob, migrations, deployment
> protection). Demos and reviews use Vercel **preview deployment
> URLs**, which run the nonproduction stack above and are reachable
> because deployment protection is disabled pre-launch (re-enabling it
> is a launch-checklist item).

## Staging

Deferred until a stable shared preproduction environment is operationally necessary.
