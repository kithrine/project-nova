# Placement Lifecycle

## Match lifecycle

- Draft
- Proposed
- Approved
- Change Requested
- Declined
- Withdrawn
- Expired

Separate decisions:

- Participant: Pending / Accepted / Declined
- Shelter: Pending / Approved / Change Requested / Declined

## Placement lifecycle

```text
Draft
→ Proposed
→ Shelter Review
→ Approved
→ Onboarding
→ Active
→ Paused
→ Active
→ Completed
```

The Placement's **Shelter Review** stage is the Shelter Manager's approval of the specific site, supervisor, and schedule package (Epic 5, Story 5.2) — distinct from the shelter's decision on the match itself in the Match lifecycle above. See `docs/decisions/ADR-013-placement-review-model.md`.

Alternate terminal states:

- Converted to Permanent Employment
- Withdrawn
- Terminated

## Activation prerequisites

- Valid enrollment
- Participant accepted
- Shelter approved
- Host and site assigned
- Supervisor and coordinator assigned
- Onboarding complete
- Training and certifications complete
- Schedule confirmed
- Active funding assignment
- No conflicting active placement
