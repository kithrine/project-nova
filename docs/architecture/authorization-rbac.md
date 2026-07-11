# Authorization and RBAC

## Model

Authorization = Permission + Resource Scope + Lifecycle State

## Roles

- Participant
- Shelter Supervisor
- Shelter Manager
- Program Coordinator
- Grant Administrator
- Nova Administrator
- Optional Restricted Review Specialist

## MVP recommendation

Store roles and organization memberships in PostgreSQL. Maintain permission definitions and role mappings in TypeScript unless runtime-configurable permissions become necessary.

## Examples

A shelter supervisor may approve a timesheet only when:

- They have `timesheet.approve`
- The placement belongs to their organization
- They are the supervisor or authorized manager
- The timesheet is Submitted

A coordinator may not view detailed background data without explicit restricted permission.
