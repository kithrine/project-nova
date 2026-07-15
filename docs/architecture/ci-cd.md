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
9. Run Playwright smoke + accessibility tests
10. Require checks before merge

## Accessibility gate (Story 7.7)

Two layers. The **CI merge gate** runs axe WCAG A/AA scans of the
public surface against every preview deployment
(`tests/e2e/a11y.spec.ts`, step 9 above) — failures block merge. The
**authenticated sweep** (`tests/e2e/a11y-authenticated.spec.ts`) scans
every signed-in experience plus keyboard and reduced-motion checks; it
needs Clerk sessions and the fixed-id E2E fixtures, which cannot
survive concurrent CI runs (the preview job is deliberately
smoke-only), so it runs in the full local Playwright suite that every
story executes before shipping.

## Branch protection

- Pull request required
- Required checks
- No direct push to `main`
- No unresolved migration failures
- Preview review before production merge

## Deployment ownership

GitHub Actions owns verification. Vercel owns deployment.

The branch-per-story development flow, commit conventions, and merge process are defined in `docs/architecture/git-workflow.md`.
