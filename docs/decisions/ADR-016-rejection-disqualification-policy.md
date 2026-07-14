# ADR-016 — Rejection, reapplication, and permanent disqualification (working policy)

## Status
Accepted as working policy. Production enablement of the disqualification
branch is gated on Colorado employment-counsel review
(`docs/ops/launch-checklist.md`). Research basis:
`docs/planning/policy-research-epic-2.md`.

> **Jurisdiction correction (2026-07-14, `ADR-019`)**: researched under an
> assumed Washington jurisdiction; the program operates in **Colorado**. The
> three categories, the 30-day window, and the template rule are unchanged.
> Category 1's citation reads through `ADR-019`: RCW 16.52.200's mandatory
> possession bans → C.R.S. § 18-9-202, where possession restrictions are
> generally discretionary — Colorado counsel must confirm how
> permanent-vs-time-limited restrictions map onto this category. RCW 49.94 in
> "Decision communication" → C.R.S. § 8-2-130 with the retained FCRA
> two-touch practice.

## Decision

This resolves open question #3 (`docs/planning/open-questions.md`) and
unblocks Stories 2.10 (its disqualification linkage) and 2.11.

### Ordinary rejection (`REJECTED`)

The default adverse outcome for every reason category — eligibility,
interview, background, or withdrawal-adjacent reasons. Reapplication is
allowed **30 days after the decision** (`Application.decidedAt` + 30 days),
enforced at the application gateway (Story 2.3's
`resolveApplicationGateway` / `startOrResumeApplication` in
`src/server/services/application-service.ts`, extended when 2.11 is built).
Each reapplication is a NEW record reviewed fresh — prior outcomes are
context, never verdicts. Before the window elapses, the gateway shows the
reapply date in respectful copy; it never renders as an error.

### Permanent disqualification (`DISQUALIFIED`)

Exactly **three qualifying categories** — nothing else may set this status:

1. **Unmitigable legal nexus**: an active PERMANENT court-ordered
   animal-possession ban (RCW 16.52.200, first-degree animal cruelty or
   animal fighting). A time-limited ban is ordinary rejection — the person
   may reapply after the ban lapses.
2. **Violence within the program**: violence or credible threats of violence
   toward staff, participants, shelter personnel, or animals, occurring
   within the program's activities.
3. **Fraud against the program**: including sustained, material
   falsification in the application itself.

Recording a disqualification requires the reviewer to select one of these
categories; the mechanics (terminal `DISQUALIFIED` status, permanent marker
on `Person`, creation-time block on future applications with respectful
messaging) are as specified in Stories 2.3 and 2.11.

### Decision communication

Every adverse decision follows the two-touch pattern (FCRA / RCW 49.94 when
a background report is involved):

1. **Before deciding** (background-based decisions): identify the specific
   record concern, provide the report and rights summary, and hold the
   position open 5 business days for correction, explanation, or evidence of
   rehabilitation (ADR-015).
2. **After deciding**: a written decision documenting the six-factor
   assessment (internal, Highly Restricted where background-based), and
   applicant-facing copy drawn ONLY from the approved templates in
   `docs/ux/content-style-guide.md` ("Decision communications") — never free
   text. Templates state plainly whether and when reapplication is possible,
   and never use "failed," "criminal," "bad candidate," or clinical
   "rejected" language.

## Rationale

Second-chance programs keep permanent exclusion vanishingly narrow — a
categorical permanent bar contradicts both the program's purpose and the
individualized-assessment mandate (ADR-015). The three categories each
survive that test: a permanent possession ban is an objective legal bar to
the core job function; violence and fraud within the program are
program-integrity grounds every reentry provider recognizes. The 30-day
reapplication window gives circumstances room to change without meaningfully
delaying a motivated applicant, and the fixed window keeps the gateway rule
simple and honest ("you may apply again on {date}").

## Consequences

Stories 2.10 and 2.11 move to Ready for Development. Story 2.11's
implementation adds the 30-day gateway window (a small extension to the 2.3
gateway logic) and reads applicant-facing copy from the approved templates.
The launch checklist gains a counsel-review gate for the disqualification
criteria and wording; until it clears, the `DISQUALIFIED` branch must not
run against real applicants. Changing the qualifying categories or the
reapplication window requires a superseding ADR.

This decision is binding for MVP. Changes require a superseding ADR.
