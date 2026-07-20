# Demo Day Operations

How the demo-day accounts and data work (ADR-022). The dataset is fictional,
`demo_`-prefixed, `isSynthetic`-flagged, and fully resettable.

## Credentials (public by design — they appear on the showcase site)

All accounts share one password: **`NovaDemo2026!`** — sign in at
**https://project-nova.app/sign-in**.

| Email                        | Signs in as               | What to look at                                                            |
| ---------------------------- | ------------------------- | -------------------------------------------------------------------------- |
| participant@project-nova.app | Katie Sullivan            | Her journey, My Placement at Front Range Rescue, My Hours, certifications  |
| ops@project-nova.app         | Marcus Webb (Coordinator) | Applications queue, urgent blockers & incidents, placements, matching      |
| shelter@project-nova.app     | Priya Natarajan (Manager) | Placement approvals, package reviews, timesheets awaiting review           |
| grants@project-nova.app      | Eleanor Park (Grant Admin)| Hours by funding source, active placements, outcome summary, exports       |
| admin@project-nova.app       | Jordan Avery (Admin)      | Everything — plus administration and the audit trail                       |

## One-time setup (Clerk dashboard — Kit)

1. **Password sign-in**: Clerk Dashboard → instance → User & Authentication →
   Password — both password toggles on. (Verified already on for production.)
2. **Client Trust OFF for the demo window** (verified blocker, 2026-07-20): with
   Client Trust on, every new device gets "Check your email to continue" after a
   correct password — and the demo addresses receive no mail, so attendees are
   hard-blocked. Use the "Configure →" link on the Client Trust banner (User &
   Authentication page) to disable new-device verification. Do this on the
   development instance for rehearsal and on production just before demo day —
   and **re-enable it on production after demo day** (it protects real staff
   accounts).

## Seeding / resetting

```bash
# Nonprod (local .env — rehearsal):
DEMO_SEED_CONFIRM=yes npx tsx prisma/demo-seed.mts

# Production (deliberate ADR-022 exception; per-instance approval):
#   vercel env pull .env.demo-prod.local --environment=production
#   then run with that env loaded, and delete the file immediately after.
```

Re-running the script **is the reset**: canonical statuses restored, attendee-made
derivative rows removed, Clerk passwords re-forced. Run it before demo day starts
and any time the demo state gets messy. Override the password with
`DEMO_USER_PASSWORD` if it ever needs rotating (update the handout to match).

## Boundaries

- The shelter login is host-org-scoped: it can only ever see demo records.
- Ops/grants/admin logins are Nova-scoped (single-program design): on production
  they also see any real Nova-side records that exist — the pre-seed census and
  Kit's go/no-go (ADR-022) cover this; real staff likewise see demo rows.
- Attendees can mutate demo records (that's the point) — reset between sessions.

## After demo day

Remove the dataset: delete `demo_`-prefixed rows (children first) and the five
Clerk users, and optionally disable the password factor again. Fictional data —
ADR-021's counsel gate does not apply.
