# Project Nova Terminology

## Applicant
A person who has started or submitted an application but has not yet been accepted.

## Application
One attempt by a person to enter Project Nova.

## Individualized Assessment
The documented, six-factor evaluation of whether a specific conviction is job-related for a specific placement (seriousness; number and types of convictions; time elapsed; verifiable rehabilitation; duties of the position; place and manner of performance), performed before any adverse decision based on offense history. Required by Washington's Fair Chance Act (RCW 49.94) and adopted as Nova's screening model in `docs/decisions/ADR-015-eligibility-screening-policy.md` — never a categorical exclusion, with the single narrow animal-care nexus screen described there.

## Lifecycle Event
An append-only record of one status transition on a workflow record (for example, an `Application` moving from `DRAFT` to `SUBMITTED`), written in the same transaction as the transition itself. Distinct from an audit event, which records access and administrative activity for security review.

## Participant
A person accepted into Project Nova.

## Program Enrollment
A participant’s period of involvement in a specific Project Nova program.

## Placement Match
A proposed relationship between a participant and a host organization.

## Placement
An approved work assignment connecting a participant, enrollment, host organization, site, supervisor, coordinator, schedule, and funding source.

## Shelter Review
The placement-lifecycle stage where the Shelter Manager approves the specific site, supervisor, and schedule package for a placement — distinct from the shelter's decision on the match itself. See `docs/decisions/ADR-013-placement-review-model.md`.

## Host Organization
The organization hosting the work. In MVP, this is usually an animal shelter.

## Shelter Site
A physical work location belonging to a host organization.

## Program Coordinator
A Nova staff member managing applications, enrollments, matching, and placements.

## Shelter Supervisor
The person providing daily workplace supervision.

## Shelter Manager
The partner representative approving placements and overseeing shelter participation.

## Funding Source
The grant, contract, or approved source funding a placement.

## Case Note
A program-coordination record, usually visible only to Nova Operations.

## Incident
A structured record of a safety, conduct, injury, animal-welfare, attendance, or workplace event.

## Employment Outcome
The participant’s verified status after transitional placement, including permanent employment.
