# Pilot Launch Checklist

> The ordered, guided execution procedure for every item below is
> `docs/ops/launch-runbook.md` (Story 7.9) — phases, exact console
> steps, verification commands, and the first-administrator bootstrap.

## Legal and operations

- Employer-of-record agreement confirmed
- Shelter agreements signed
- Insurance confirmed
- Screening policy approved (working policy `ADR-015`; Colorado employment-counsel review required before review workflows run against real applicants — jurisdiction corrected per `ADR-019`, including the C.R.S. § 8-2-130 government-program exception question)
- Background-check and adverse-action process reviewed by Colorado employment counsel (`ADR-015`/`ADR-019`; includes consumer-report content limits and any local fair-chance ordinances in the service area)
- Permanent-disqualification criteria and applicant-facing wording reviewed by counsel (`ADR-016`; includes mapping C.R.S. § 18-9-202 possession restrictions onto the permanent-vs-time-limited categories, `ADR-019`)
- Employer-of-record/host training responsibilities reviewed against federal OSHA duties (29 CFR 1910; Colorado has no state plan) and the Colorado heat-illness rule (7 CCR 1103-15); shelter agreement and record-confirmation process approved (`ADR-017`/`ADR-019`)
- Placement-termination process reviewed by Colorado employment counsel (`ADR-018`/`ADR-019`; at-will status of transitional workers, wrongful-termination exposure, C.R.S. § 8-4-109 immediate final-pay timing in the payroll process, grant documentation standards)
- Incident procedures approved
- Grant requirements mapped (includes validating the provisional reporting format `ADR-020` against each executed award before any reimbursement use, and each award's export field sets and any artifact-storage demands against the ephemeral-export rule, `ADR-021`)
- Retention schedule reviewed by Colorado counsel (`ADR-021`; the provisional 5-year / 3-years-from-final-report schedule and the no-deletion posture — no deletion capability may be implemented before this review)
- Payroll process confirmed

## Technical

- Production Clerk configured (until this and its siblings are done, the Vercel Production environment is intentionally empty and the production URL fails with `500 MIDDLEWARE_INVOCATION_FAILED` — see `docs/architecture/environments.md`; launch verification includes confirming that 500 is gone)
- Production Neon configured
- Production Blob store configured (separate from the nonproduction store; ADR-014)
- Migrations applied
- Custom domain active
- Branch protection active
- Vercel Deployment Protection re-enabled (disabled during pre-launch so CI can smoke-test previews)
- Backups verified
- Logs and alerts verified
- E2E smoke tests pass
- Accessibility review complete
- Synthetic test data removed

## People

- Nova staff trained
- Shelter managers trained
- Supervisors trained
- Participant support process ready
- Escalation contacts documented
