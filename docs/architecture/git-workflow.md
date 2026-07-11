# Git Workflow

How Project Nova uses git and GitHub. AI agents and humans follow this for all implementation work. The goal is a consistent, highly-automated **branch-per-story** flow that keeps `main` always deployable.

## Repository

- Remote: `origin` = `git@github.com:kithrine/project-nova.git` (SSH).
- Default branch: `main`. `main` is always deployable.
- The `gh` CLI is authenticated with `repo` scope, so agents create **and merge** pull requests from the command line; the browser is only a fallback when a merge is blocked.

## Branch naming

Lowercase, kebab-case, prefixed by type:

- `story/<epic>.<story>-<slug>` — one user story. E.g. `story/1.1-initialize-nextjs`, `story/4.8-approve-match`.
- `chore/<slug>` — tooling, config, dependencies.
- `docs/<slug>` — documentation-only changes.
- `fix/<slug>` — bug fixes.
- `refactor/<slug>` — refactors with no behavior change.
- `spike/<slug>` — throwaway exploration.

## Granularity: one branch and PR per story

Default to **one branch → one PR → one squash-merge per user story** (`docs/stories/`). This keeps each change reviewable, keeps `main` history readable (one commit per story), and maps directly to the backlog.

Group multiple stories on one branch only when they cannot be merged independently — e.g. the tightly-coupled pair Stories 6.2 and 6.3, or the Epic 1 setup stories that stand up the project before anything else can build. Note the grouping in the PR description.

## Commits

Use Conventional Commits: `type(scope): summary`.

- Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `build`, `style`.
- Reference the story in the summary or body: `feat(applications): submit application (Story 2.5)`.
- Commit in small, logical steps as you go — not one giant commit at the end.
- Every commit ends with the trailer:

  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## Documentation synchronization (required)

Per `RULES.md`, any behavior change updates the affected documentation **in the same PR** — product, architecture, UX, stories, terminology, and ADRs. A PR that changes behavior without the matching doc update is not ready to merge. The pull request template includes this checkbox.

## The per-story loop (automated)

```bash
# 1. Start from an up-to-date main
git checkout main
git pull

# 2. Branch for the story
git checkout -b story/2.5-submit-application

# 3. Implement, committing in logical steps
git add <paths>
git commit -m "feat(applications): submit application (Story 2.5)" \
           -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"

# 4. Verify before pushing (once the toolchain exists — Epic 1)
npm run lint && npm run typecheck && npm test    # plus Playwright where relevant

# 5. Push and open a PR
git push -u origin story/2.5-submit-application
gh pr create --fill --base main

# 6. Merge (squash) and delete the branch
gh pr merge --squash --delete-branch
#    If the merge is blocked (required checks pending, or a review is required),
#    print the PR URL and let the user click Merge in the browser (Claude browser MCP).

# 7. Return to main and continue
git checkout main
git pull
# -> next story
```

## Merge strategy

- **Squash and merge**, then **delete the branch**. One clean commit per story lands on `main`.
- The squash commit message follows the same Conventional Commit + trailer convention.

## Pull requests

- Title: `Story <id>: <title>` (e.g. `Story 2.5: Submit application`).
- Body (see `.github/pull_request_template.md`): summary, the story's acceptance criteria as a checklist, tests run, and the Documentation-synchronization checkbox.
- Link the story doc (`docs/stories/epic-<n>-*.md`).

## Branch protection and CI (active since Story 1.6)

- `main` is protected: no direct pushes (admins included), required checks (`quality`, `preview`) must pass, linear history enforced.
- Merge with `gh pr merge --squash --auto --delete-branch` — the merge completes automatically once checks go green. Use the browser (or `gh pr view --web`) as the fallback when a merge is blocked or a human review is wanted.
- The pipeline (`.github/workflows/ci.yml`) runs the ten checks from `docs/architecture/ci-cd.md`: the `quality` job (lint, type check, Prisma validate, migration status, full Vitest suite against the shared nonproduction database) and the `preview` job (waits for Vercel's Git-integration preview deployment of the commit — Vercel owns deployment, GitHub Actions owns verification — then runs Playwright smoke and accessibility tests against the preview URL).
- Full path: `feature branch → PR → GitHub Actions → Vercel preview → review → merge → production` (`docs/architecture/deployment.md`).

## Working agreements

- **Never commit secrets** — no `.env*`, tokens, or database URLs (`RULES.md`). Add them to `.gitignore` in Epic 1.
- **Migrations travel with code** — commit Prisma migration files in the same commit/PR as the schema and code that need them; `prisma migrate dev` locally, `prisma migrate deploy` in CI (`docs/architecture/database-design.md`).
- **Keep branches short-lived** and pull `main` often — this is a shared working directory with concurrent activity, so frequent `git pull` avoids drift.
- **Resolve conflicts by rebasing onto `main`**: `git fetch origin && git rebase origin/main`, then `git push --force-with-lease`.
- **Line endings:** the repo currently mixes CRLF/LF. Add a `.gitattributes` normalizing text to LF in Epic 1 to avoid noisy diffs; until then the `LF will be replaced by CRLF` warnings on commit are harmless.
- **Stage explicit paths** (`git add <path>`) rather than `git add -A` when other work may be in progress in the same tree.

## gh CLI quick reference

- `gh pr create --fill --base main` — open a PR from the current branch.
- `gh pr merge --squash --delete-branch` — squash-merge and clean up.
- `gh pr merge --squash --auto --delete-branch` — auto-merge once required checks pass.
- `gh pr view --web` — open the PR in the browser for a manual merge.
- `gh pr status` — see the state of your PRs.

Note: the current token lacks the `workflow` scope, so creating or modifying `.github/workflows/*` via the GitHub API is restricted — but pushing those files over SSH (a normal `git push`) works fine.
