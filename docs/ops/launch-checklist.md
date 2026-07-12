# Pilot Launch Checklist

## Legal and operations

- Employer-of-record agreement confirmed
- Shelter agreements signed
- Insurance confirmed
- Screening policy approved (working policy `ADR-015`; Washington employment-counsel review required before review workflows run against real applicants)
- Background-check and adverse-action process reviewed by Washington employment counsel (`ADR-015`; includes the "unsupervised access to vulnerable persons" exemption question)
- Permanent-disqualification criteria and applicant-facing wording reviewed by counsel (`ADR-016`)
- Employer-of-record/host training responsibilities reviewed against WAC 296-801 and related WISHA rules; shelter agreement and record-confirmation process approved (`ADR-017`)
- Incident procedures approved
- Grant requirements mapped
- Payroll process confirmed

## Technical

- Production Clerk configured
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
