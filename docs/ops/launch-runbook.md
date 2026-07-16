# Production Launch Runbook — Story 7.9

> **Executed 2026-07-15.** Phases 0–9 completed and verified in the
> guided session; `https://project-nova.app` is live. Phase 10's
> sign-off table remains the operational tracker for the counsel and
> people gates. Session notes: the `www` subdomain was added post-launch
> with an accidental reverse redirect (apex→www) that would have broken
> Clerk webhook delivery — caught by probe, corrected to www→apex 308;
> Google sign-in required custom OAuth credentials (Clerk production
> instances don't ship shared Google credentials) — wired via Google
> Auth Platform and verified live.

The ordered, guided procedure that turns `docs/ops/launch-checklist.md`
into a working production deployment. Roles: **Kit** performs every
console action, purchase, and secret entry (secrets are never typed by
or shown to the assistant — per-instance approval each time); the
assistant verifies each phase from the repo side and runs the checks.

**Ordering constraint that shapes everything:** a Clerk *production*
instance requires the real domain (it cannot run on `*.vercel.app`), so
the domain comes first and Clerk follows it.

Mark each box when done. Stop at any failed verification — later phases
assume earlier ones.

---

## Phase 0 — Preflight (no console needed)

- [ ] Epics 1–6 complete; Epic 7 stories 7.1–7.8 merged and green.
- [ ] `main` CI green; accessibility (7.7) and security (7.8) suites pass.
- [ ] Legal/People sign-off table (Phase 10) reviewed — launch can be
      *technically* completed while counsel gates remain open, but real
      applicants must not be processed until they close (ADR-015/016).

## Phase 1 — Custom domain (Kit)

- [ ] Buy or choose the domain (any registrar; Vercel can also sell one:
      Vercel dashboard → project **project-nova** → Settings → Domains).
- [ ] Add it to the Vercel project (Settings → Domains → Add). Follow
      Vercel's DNS instructions (A/CNAME at the registrar).
- [ ] Verify: the domain shows **Valid Configuration** in Vercel and
      serves the same 500 as `project-nova-lake.vercel.app` (expected —
      Production env is still empty).

## Phase 2 — Production Clerk instance (Kit)

- [ ] dashboard.clerk.com → the Project Nova application → **Create
      production instance** (environment switcher). Use the Phase 1
      domain.
- [ ] Add the DNS records Clerk requests (CNAMEs for `clerk.<domain>`,
      `accounts.<domain>`, plus email records) and wait for Clerk to
      show them verified.
- [ ] Copy the **production** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
      (`pk_live_…`) and `CLERK_SECRET_KEY` (`sk_live_…`) — entered into
      Vercel in Phase 5, nowhere else. Never into the repo or chat.
- [ ] In Clerk production settings, mirror the dev instance's enabled
      sign-in methods (email code; Google if desired).

## Phase 3 — Production Neon database (Kit)

- [ ] console.neon.tech → **New project** (separate from the
      nonproduction project; same region as Vercel functions if offered).
- [ ] Copy the pooled connection string and the direct (non-pooler)
      variant. Both must end `?sslmode=verify-full` (edit if the console
      emits `require`).
- [ ] Note: Neon point-in-time restore is the backup mechanism — confirm
      the history-retention window in project settings (Phase 8 verifies).

## Phase 4 — Production Blob store (Kit)

- [ ] Vercel dashboard → Storage → Create **Blob** store (name it
      clearly, e.g. `nova-documents-production`) → connect it to the
      project for the **Production** environment only.
- [ ] Vercel injects `BLOB_READ_WRITE_TOKEN` into Production on connect —
      confirm it appears under Settings → Environment Variables.

## Phase 5 — Vercel Production environment variables (Kit)

Settings → Environment Variables → scope **Production** only. The
complete set (mirrors `.env.example`):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled string (Phase 3), `sslmode=verify-full` |
| `DIRECT_DATABASE_URL` | Neon direct string (Phase 3) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` (Phase 2) |
| `CLERK_SECRET_KEY` | `sk_live_…` (Phase 2) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/dashboard` |
| `BLOB_READ_WRITE_TOKEN` | injected by Phase 4 |
| `CLERK_WEBHOOK_SIGNING_SECRET` | added in Phase 7 |

- [ ] All rows present, scoped to Production, none leaked into Preview.

## Phase 6 — Production migrations (Kit + assistant)

- [ ] GitHub repo → Settings → Secrets and variables → Actions → add
      `DATABASE_URL_PRODUCTION` and `DIRECT_DATABASE_URL_PRODUCTION`
      (the Phase 3 strings). The pre-wired workflow
      (`.github/workflows/deploy-migrations.yml`) no-ops until these
      exist.
- [ ] Run the **Production migrations** workflow (Actions tab →
      workflow_dispatch) — it applies every committed migration via
      `prisma migrate deploy` and verifies `migrate status`.
- [ ] Verify: workflow green; the Neon console shows the schema.

## Phase 7 — First deploy + Clerk webhook (Kit + assistant)

- [ ] Redeploy Production (Vercel → Deployments → latest `main` →
      Redeploy) so the Phase 5 env takes effect. The 500 disappears.
- [ ] Clerk production dashboard → Webhooks → Add endpoint:
      `https://<domain>/api/webhooks/clerk`, events `user.created` +
      `user.updated`. Copy the signing secret into Vercel Production as
      `CLERK_WEBHOOK_SIGNING_SECRET`, then redeploy once more.
- [ ] Verify: Clerk's webhook test event returns 2xx; an unsigned POST
      returns 400 (the 7.8 boundary).

## Phase 8 — Verification (assistant, with Kit watching)

- [ ] `https://<domain>/api/health` → `{"status":"ok","database":"connected"}`.
- [ ] Production smoke + accessibility suites against the live domain:
      `PLAYWRIGHT_BASE_URL=https://<domain> npx playwright test tests/e2e/smoke.spec.ts tests/e2e/a11y.spec.ts`
- [ ] **Bootstrap the first administrator**: Kit signs up on the
      production site (real email). The webhook provisions the user; the
      membership is then created once, by hand, in the Neon SQL console:
      ```sql
      INSERT INTO "Organization" (id, name, kind, "isSynthetic", "createdAt", "updatedAt")
      VALUES ('org_nova_prod', 'Nova Operations', 'NOVA', false, now(), now());
      INSERT INTO "Membership" (id, "userId", "organizationId", role, status, "createdAt", "updatedAt")
      SELECT 'mem_nova_admin', u.id, 'org_nova_prod', 'NOVA_ADMINISTRATOR', 'ACTIVE', now(), now()
      FROM "User" u WHERE u.email = '<kit-production-email>';
      ```
      Sign out/in; the Operations experience appears. Every later user
      is managed in-app.
- [ ] **Synthetic test data removed**: the production database was born
      empty and no seed/fixture script may ever point at it. Verify:
      `SELECT count(*) FROM "User" WHERE "isSynthetic" = true;` → `0`.
- [ ] Backups: Neon history retention confirmed (Phase 3).
- [ ] Logs and alerts: Vercel → project → Logs streaming; enable
      Observability alerts (error-rate email) if on a plan that has them.

## Phase 9 — Protection (Kit)

- [ ] GitHub branch protection on `main` confirmed: PR required, checks
      required, no direct push (Settings → Branches).
- [ ] **Re-enable Vercel Deployment Protection** (Settings → Deployment
      Protection → Standard Protection). It was disabled pre-launch so
      CI could smoke-test previews. Standard Protection gates preview
      URLs and `*.vercel.app`; the custom production domain stays
      public, which is exactly right.
- [ ] CI bypass wired (launch day): Playwright sends
      `x-vercel-protection-bypass` whenever the
      `VERCEL_AUTOMATION_BYPASS_SECRET` env is set, and the `preview` job
      passes it from the GitHub secret of the same name — generate the
      token under Deployment Protection → Protection Bypass for
      Automation and add it as that GitHub Actions secret.

## Phase 10 — Legal, operations, and people sign-offs (tracked, not code)

| Gate | Source | Status |
| --- | --- | --- |
| Employer-of-record agreement | checklist | ☐ |
| Shelter agreements signed | checklist | ☐ |
| Insurance confirmed | checklist | ☐ |
| Screening policy — Colorado counsel | ADR-015/019 | ☐ |
| Background/adverse-action process — counsel | ADR-015/019 | ☐ |
| Disqualification wording — counsel | ADR-016/019 | ☐ |
| Safety-duty allocation (federal OSHA + 7 CCR 1103-15) | ADR-017/019 | ☐ |
| Termination process — counsel (C.R.S. § 8-4-109) | ADR-018/019 | ☐ |
| Grant fields/format validated against executed awards | ADR-020 | ☐ |
| Retention schedule — counsel | ADR-021 | ☐ |
| Incident procedures approved | checklist | ☐ |
| Payroll process confirmed | checklist | ☐ |
| Staff, manager, supervisor training | checklist | ☐ |
| Participant support + escalation contacts documented | checklist | ☐ |
| Live screen-reader spot check with real users | 7.7 review | ☐ |

**Launch is declared** when Phases 1–9 verify and the program owner
accepts Phase 10's state (technical launch may precede final counsel
sign-off only with synthetic/demo data; real applicants wait for the
ADR-015/016 gates).
