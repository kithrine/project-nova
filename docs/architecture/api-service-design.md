# API and Service Design

## Boundaries

### Server Actions
First-party form and workflow mutations.

### Route Handlers
- Clerk webhooks
- Upload authorization and completion
- Secure downloads
- Exports
- Health checks
- External integrations

## Services

- ApplicationService
- EnrollmentService
- PlacementMatchService
- PlacementService
- TimesheetService
- EvaluationService
- IncidentService
- CaseNoteService
- TrainingService
- CertificationService
- FundingService
- DocumentService
- ReportingService
- UserService
- OrganizationService

## Authorization flow

1. Authenticate
2. Resolve internal user
3. Resolve memberships
4. Check permission
5. Load resource
6. Check scope
7. Check lifecycle
8. Check prerequisites
9. Execute transaction
10. Write events
11. Return shaped result

## Error classes

- Validation
- Authentication
- Authorization
- Lifecycle
- Conflict
- Not found
- Infrastructure
