# CI/CD

## Pull request checks

1. Install dependencies
2. Lint
3. Type check
4. Validate Prisma schema
5. Run unit tests
6. Run component tests
7. Build Next.js
8. Create Vercel preview
9. Run Playwright smoke tests
10. Require checks before merge

## Branch protection

- Pull request required
- Required checks
- No direct push to `main`
- No unresolved migration failures
- Preview review before production merge

## Deployment ownership

GitHub Actions owns verification. Vercel owns deployment.
