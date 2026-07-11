# Project Folder Structure

```text
src/
  app/
    (public)/
    (participant)/
    (shelter)/
    (operations)/
    api/
  components/
    ui/
    layout/
    workflow/
    data/
    feedback/
  features/
    applications/
    enrollments/
    funding/
    placements/
    timesheets/
    incidents/
    training/
    reports/
  server/
    auth/
    services/
    repositories/
    domain/
    audit/
    database/
    errors/
  lib/
  styles/
  types/
prisma/
tests/
docs/
```

## Rule

Generic UI belongs in `components`. Domain-specific UI belongs under the relevant `features` directory.
