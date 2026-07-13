# Business Rules

## Applications

- A person may submit multiple applications over time.
- Reapplication creates a new record, allowed 30 days after an ordinary rejection (`ADR-016`).
- Terminal applications are not reopened.
- Permanent disqualification blocks future applications under the three narrow categories in `ADR-016`.
- Background decisions require restricted permission.

## Enrollment

- Accepted application creates participant and enrollment records transactionally.
- Enrollment cannot become placement-active manually.
- Required onboarding and training must be complete before matching readiness.

## Training

- The default Program requires the three portable Training Programs in `ADR-017` before matching readiness.
- Requiredness is configured on the Program training catalog so a missing enrollment remains a blocker.
- Training Enrollment transitions are action-based: Enrolled → In Progress/Completed/Withdrawn and In Progress → Completed/Withdrawn.
- Completed and Withdrawn attempts are terminal; a later attempt is a new record.
- Completion requires a structured evidence method; attendance alone is not demonstrated competency.
- Portable completion never replaces host-site safety orientation and task-specific competency confirmation.

## Placements

- A participant may have multiple historical placements.
- A participant may have only one onboarding/active/paused placement at a time in MVP.
- Placement activation requires accepted participant decision, shelter approval, supervisor, schedule, site, training, onboarding, and active funding.
- Terminal placements are not reopened.
- Terminal outcomes are recorded by Nova Operations only; termination is a single-actor `placement.terminate` action with a required reason category (`ADR-018`) — shelters escalate through incidents or case notes.

## Timesheets

- Participants may edit draft or rejected timesheets.
- Shelter or authorized Nova staff approve.
- Approved records cannot be silently changed.
- Locked records require adjustment workflow.

## Funding

- One active funding assignment per placement in MVP.
- Blended funding is deferred.

## Privacy

- Shelters cannot view raw applications, background details, or internal Nova notes.
- Exports are named, scoped, permission-controlled, and audited.
