# Domain Model

## Core flow

```text
Person
→ Application
→ Participant
→ Program Enrollment
→ Placement Match
→ Placement
→ Employment Outcome
```

## Core entities

- User
- Organization
- Organization Site
- Membership
- Person
- Applicant Profile
- Application
- Eligibility Review
- Interview
- Background Review
- Participant
- Program
- Cohort
- Program Enrollment
- Onboarding Task
- Training Program
- Training Enrollment
- Certification
- Placement Match
- Placement
- Schedule
- Timesheet
- Work Entry
- Evaluation
- Incident
- Case Note
- Funding Source
- Funding Assignment
- Employment Outcome
- Document
- Lifecycle Event (per workflow record, e.g. Application Event)
- Audit Event

## Aggregate boundaries

- Application
- Program Enrollment
- Placement Match
- Placement
- Timesheet
- Incident

Placement is a hub, not a god object.

Training Program and Training Enrollment cover portable pre-matching preparation. Site-specific training and competency are Placement-owned onboarding records (`ADR-017`).
