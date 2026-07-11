# Testing Strategy

## Tools

- Vitest
- React Testing Library
- Playwright
- TypeScript
- ESLint

## Unit tests

- Lifecycle transitions
- Activation blockers
- Permissions
- Compatibility rules
- Work-hour calculations
- Response shaping

## Component tests

- Form errors
- Journey timeline
- Status badges
- Upload states
- Timesheet behavior
- Accessibility

## Integration tests

- Prisma transactions
- Partial indexes
- Audit events
- Organization scoping
- Idempotency
- Shared nonproduction database behavior

## E2E tests

- Applicant submits application
- Coordinator accepts application
- Match is proposed and approved
- Placement activates
- Participant submits hours
- Shelter approves hours
- Cross-shelter access is denied

## Coverage policy

Do not chase arbitrary percentages. Cover every critical business rule and high-risk user journey.
