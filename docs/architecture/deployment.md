# Deployment

## Hosting

Vercel hosts the Next.js application.

## Deployment flow

```text
Feature branch
→ Pull request
→ GitHub Actions
→ Vercel Preview
→ Review
→ Merge to main
→ Production deployment
```

## Custom domain

The production custom domain points to the Vercel production project.

## Deployment responsibilities

- GitHub Actions: quality checks
- Vercel: preview and production deployment
- Prisma: migrations
- Neon: PostgreSQL
- Clerk: authentication

Branch naming, the per-story pull-request loop, and merge conventions are defined in `docs/architecture/git-workflow.md`.
