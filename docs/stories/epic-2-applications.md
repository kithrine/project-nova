# Epic 2 — Participant Applications

## Goal
Allow applicants to apply and track progress.

## Stories

| ID | Story | Status |
|---|---|---|
| 2.1 | Public How It Works page | Done |
| 2.2 | Applicant account onboarding | Done |
| 2.3 | Create and save draft application | Done |
| 2.4 | Upload required documents | Done |
| 2.5 | Submit application | Done |
| 2.6 | View participant-safe application journey | Done |
| 2.7 | Operations applications queue | Done |
| 2.8 | Eligibility review | Ready for Development |
| 2.9 | Interview workflow | Ready for Development |
| 2.10 | Background decision workflow | Ready for Development |
| 2.11 | Acceptance and rejection | Ready for Development |

> Sequencing note: the epic is numbered 2.1–2.11 for reference, but Stories 2.8, 2.9, and 2.10 each hand off negative outcomes to the shared reject action specified in 2.11 — build 2.11's rejection path alongside or before 2.8 rather than strictly last. Story 2.6 depends only on the `Application` status enum introduced in 2.3, so it can be built in parallel with the Operations-side stories (2.7–2.11).

---

## Story 2.1 — Public How It Works page

### Status
Done

### User story
As a prospective applicant, I want a public page that plainly explains how Project Nova works and what to expect, so that I can decide whether to start an application without needing an account.

### Scope
- Build the How It Works page in the `(public)` route group (established in 1.1), reachable from primary public navigation.
- Explain the program in plain language: what it is, who it is for, what paid transitional work at a host shelter involves, and the high-level shape of the journey from application to placement, without exposing internal operational detail (`docs/product/participant-lifecycle.md`).
- Set expectations honestly: this page informs, it does not determine eligibility — actual eligibility is determined during review (2.8), and the page must not state guarantees.
- Provide one clear primary call to action that leads into applicant account onboarding (2.2).
- Follow the voice in `docs/ux/content-style-guide.md`: respectful, direct, calm, plain language, no stigmatizing terms.

### Acceptance criteria
1. Given an anonymous visitor, when they navigate to the How It Works page, then it renders without requiring authentication.
2. Given the page content, when read, then it describes the program and the applicant journey in plain, respectful language with no stigmatizing terms (for example, no "criminal," no bureaucratic jargon), per `docs/ux/content-style-guide.md`.
3. Given the page, when viewed, then exactly one primary call to action is presented, using a specific action verb (for example, "Start Application," not a bare "Submit"), and it links into applicant account onboarding (2.2).
4. Given the page describes expectations, when read, then it does not assert a guarantee of eligibility or acceptance; it explains that eligibility is determined during review.
5. Given a 360px mobile viewport, when the page renders, then content is single-column with no horizontal scroll, and the primary call to action is reachable near the top.
6. Given a screen-reader user, when navigating the page, then headings are semantic and in order, and landmarks (`header`, `main`, `nav`) are present.

### Authorization
None. The `(public)` route group requires no authentication or permission; this page carries no participant- or applicant-specific data.

### Lifecycle rules
None. This story does not read or write any `Application` record.

### Data changes
None. Page content is static within the `(public)` route group; no database model is introduced.

### UX and accessibility
Semantic heading structure, visible focus styles, `prefers-reduced-motion` support (from 1.1's global styles), SVG icons only (no emojis, per `docs/ux/visual-design-reference.md`), AA contrast, mobile-first layout that progressively enhances.

### Tests
- Unit: not applicable (no logic).
- Integration: not applicable (no data layer).
- Component: the page renders the required headings and exactly one primary call to action.
- E2E: an anonymous visitor loads the page and the call to action navigates into applicant account onboarding.

### Out of scope
The other public pages listed in `docs/ux/information-architecture.md` (Home, About, Eligibility detail, FAQ, Contact) are not part of this canonical story set; the actual eligibility determination (2.8); account creation itself (2.2).

### Dependencies
1.1 (Next.js foundation and the `(public)` route group).

---

## Story 2.2 — Applicant account onboarding

### Status
Done

### User story
As a prospective applicant, I want to create my Project Nova account and provide my basic identity information, so that I can start an application under my own, private record.

### Scope
- Reuse Clerk sign-up/sign-in (1.2) for authentication; on first entry into the applicant experience, provision a `Person` and an `ApplicantProfile` linked to the internal `User` (1.4).
- Collect the minimum identity and contact information needed to start an application (for example, legal name, date of birth, contact details, mailing address); the exact field set is an implementation detail of this story, not fixed by upstream docs.
- Make provisioning idempotent: a returning applicant reuses their existing `Person`/`ApplicantProfile` rather than creating a duplicate.
- Land the applicant on the `(participant)` protected shell (1.7) scoped to applicant-stage screens, starting with My Application (2.3).
- Establish the applicant/participant distinction in the data model: a `Person`/`ApplicantProfile` alone grants no `Role` and no `Membership` — it is not the same as being a Participant. Participant status, and the `Membership` that comes with it, is only created on acceptance (Epic 3, Story 3.1).

### Acceptance criteria
1. Given a signed-in Clerk user with no existing `Person`, when they first enter the applicant experience, then a `Person` and an `ApplicantProfile` are created and linked to their internal `User`.
2. Given a returning applicant with an existing `Person`/`ApplicantProfile`, when they sign in again, then the existing record is reused and no duplicate is created.
3. Given required onboarding fields are missing or invalid, when the applicant submits them, then field-level, accessible validation errors are shown, and no partial `Person`/`ApplicantProfile` blocks a retry.
4. Given onboarding completes, when the applicant is redirected, then they land on the `(participant)` shell scoped to applicant-stage screens, per the layout built in 1.7.
5. Given client-supplied identity data, when the write executes, then the `Person`/`ApplicantProfile` is linked to the server-resolved authenticated `User` only — a client-supplied user ID is never trusted.
6. Given a `Person`/`ApplicantProfile` exists, when checked, then it confers no `Role` and no `Membership`; the applicant is not a Participant until Story 3.1 creates that status on acceptance.

### Authorization
Requires authentication (Clerk) only — no `Role` or `Membership` is required or created here, and no operations-style permission gate applies. Resource scope is ownership: an authenticated user may create or view only their own `Person`/`ApplicantProfile`, never another user's, checked server-side against the resolved `User`, never a client-supplied ID. This is the applicant/participant distinction in practice: applicant self-service runs on ownership-based authorization, while Nova Operations and shelter routes run on `Membership`-and-role-scoped authorization.

### Lifecycle rules
None. `Person` and `ApplicantProfile` are prerequisite identity records for `Application` (2.3), not lifecycle objects themselves.

### Data changes
Creates `Person` and `ApplicantProfile`, linked to `User` (1.4). Creates no `Membership` and assigns no `Role`.

### UX and accessibility
Labels above inputs, programmatic error association, mobile-first single-column form, plain language, Loading/Error/Success states, respectful tone per `docs/ux/content-style-guide.md`.

### Tests
- Unit: onboarding field validation (Zod schema).
- Integration: idempotent create-or-reuse of `Person`/`ApplicantProfile` per `User`; ownership scoping denies access to another user's record.
- Component: form validation states and accessible error messages.
- E2E: a new user signs in via Clerk, completes onboarding, and lands on the My Application entry point.

### Out of scope
The application form itself (2.3), document upload (2.4), `Membership`/`Role` creation (Epic 3, Story 3.1), profile edits after acceptance.

### Dependencies
1.2 (Clerk), 1.4 (`User` model), 1.5 (authorization context), 1.7 (participant protected layout), 2.1 (entry point).

---

## Story 2.3 — Create and save draft application

### Status
Done

### User story
As an applicant, I want to start an application and save my progress as a draft, so that I can complete it over multiple visits without losing my work.

### Scope
- Define the `Application` model and its status lifecycle: `DRAFT`, `SUBMITTED`, `ELIGIBILITY_REVIEW`, `INTERVIEW`, `BACKGROUND_REVIEW`, `ACCEPTED`, `REJECTED`, `DISQUALIFIED`. This story introduces the full enum; later stories in this epic drive the transitions past `DRAFT`.
- Create a new `Application` in `DRAFT` status, linked to the applicant's `Person`, the first time they start applying.
- Build the application form with the Application Step Card component (`docs/ux/component-guidelines.md`) that saves partial, incomplete data as a draft; draft saves do not enforce the completeness required at submission (2.5).
- Enforce at most one non-terminal `Application` per person: a new draft can only be started if the person has no `Application` currently in `DRAFT` through `BACKGROUND_REVIEW`.
- Support reapplication: once a prior `Application` reaches `REJECTED`, a new `Application` may be created — a new record, per `docs/product/business-rules.md`. Once a prior `Application` reaches `DISQUALIFIED`, no new `Application` may be created (permanent disqualification; see 2.11).

### Acceptance criteria
1. Given an applicant with no active (non-terminal) `Application`, when they start applying, then a new `Application` is created in `DRAFT` status linked to their `Person`.
2. Given an applicant with an existing `DRAFT` `Application`, when they return to Apply, then they resume that same draft rather than creating a duplicate.
3. Given an applicant whose only prior `Application` is `REJECTED`, when they start a new application, then a new `Application` record is created and the prior record is preserved unchanged.
4. Given an applicant whose only prior `Application` is `DISQUALIFIED`, when they attempt to start a new application, then creation is blocked and the applicant sees respectful, approved messaging rather than an error page (see 2.11 for how this flag is set).
5. Given a `DRAFT` in progress, when the applicant saves, then partial and incomplete data persists without triggering submission-level validation.
6. Given a draft is read back, when rendered, then only the requesting applicant's own `Application` data is returned — never another person's, and never trusting a client-supplied application ID without an ownership check.

### Authorization
Permission `application.create` and `application.edit`, resolved for any authenticated applicant with a `Person` (2.2) — not tied to a `Membership` or `Role`, consistent with 2.2's applicant/participant distinction. Resource scope is ownership (`Application.personId` matches the resolved user's `Person`). Lifecycle gate: editing is only permitted while `Application.status` is `DRAFT`.

### Lifecycle rules
`Application` is created directly into `DRAFT`. `DRAFT` is the only status in which the applicant may edit form content. The transition out of `DRAFT` happens only through the explicit Submit action (2.5) — never a free status edit, per the lifecycle constraints in `docs/product/prd.md`.

### Data changes
Creates `Application` (`id`, `personId`, `status`, form-response fields, `createdAt`, `updatedAt`, `submittedAt` (null until 2.5), `decidedAt`/`decisionReason` (null until 2.11)) with the `SCREAMING_SNAKE_CASE` status enum listed in Scope.

### UX and accessibility
Application Step Card component with a visible progress indicator, an explicit non-destructive Save Draft action, labels above inputs, programmatic error association, mobile-first single column, Loading/Empty/Error/Success/Disabled/Concurrent update states (concurrent update matters if the same draft is open in two tabs or devices).

### Tests
- Unit: draft-vs-submission validation differences; the one-active-application rule; reapplication-after-`REJECTED` versus blocked-after-`DISQUALIFIED` rules.
- Integration: `Application` creation and draft updates scoped to the owning `Person`; concurrent-save handling.
- Component: step form rendering, Save Draft flow, validation states.
- E2E: an applicant creates an account, starts a draft, saves, signs out, signs back in, and resumes the same draft.

### Out of scope
Document upload (2.4), submission and completeness enforcement (2.5), operations visibility into drafts (drafts are never visible to Nova Operations or shelters; see 2.7).

### Dependencies
2.2 (`Person`/`ApplicantProfile`), 1.5 (authorization context).

---

## Story 2.4 — Upload required documents

### Status
Done

### User story
As an applicant, I want to securely upload the documents my application requires, so that reviewers have what they need without me emailing sensitive files.

### Scope
- Document upload via the authorized-upload pattern (`docs/architecture/api-service-design.md`): a Route Handler issues a short-lived, authorized upload target; the file transfers directly to secure storage; a second Route Handler call confirms completion and creates the `Document` record. File bytes are never proxied through a Server Action.
- Support the required document set an application needs (for example, government-issued identification and any other program-required documents), with a visible checklist of what is missing versus uploaded.
- Allow re-upload/replacement of a document before submission (2.5) and, since coordinators may ask for more information during review (per the "We need one more document" pattern in `docs/ux/content-style-guide.md`), while the application remains non-terminal.
- Validate file type and size both client- and server-side.
- Treat `Document` contents as Highly Restricted (`docs/architecture/security-privacy.md`): never logged, never exposed to shelters, and served internally only through short-lived secure download URLs, never persisted client-side.

### Acceptance criteria
1. Given a non-terminal `Application`, when the applicant selects a required document type to upload, then the system issues an authorized upload target and the file transfers directly to secure storage.
2. Given a completed upload, when the client confirms it, then a `Document` record is created — owned by the `Application` — with metadata (type, filename, size, content type, uploader, timestamp); file contents are never stored in the primary database and never written to logs.
3. Given an unsupported file type or an oversized file, when upload is attempted, then it is rejected with a specific, actionable error, both client- and server-side.
4. Given a document was already uploaded, when the applicant uploads a replacement, then the prior file is superseded (archived, not hard-deleted) and the current one is what submission and review use.
5. Given the required document checklist, when viewed, then the applicant clearly sees which required documents are missing versus uploaded, using text and icon indicators, never color alone.
6. Given a user who does not own the `Application` (another applicant, or a shelter user), when they attempt to access a document's upload or download URL directly, then access is denied server-side regardless of a guessed or replayed URL.

### Authorization
Permission `document.upload` and `document.view`, ownership-scoped to the applicant's own `Application` for applicants (no `Membership` required, consistent with 2.2/2.3). Nova Operations reviewers require `document.view` under Nova organization scope (used starting in 2.7/2.8); shelters are never granted `document.view` for application documents, per the Privacy rules in `docs/product/business-rules.md`.

### Lifecycle rules
Uploads are permitted while `Application.status` is non-terminal (`DRAFT` through `BACKGROUND_REVIEW`), not only while `DRAFT`, so the applicant can respond to a reviewer's request for more information after submission. No upload is accepted once the `Application` reaches `ACCEPTED`, `REJECTED`, or `DISQUALIFIED`.

### Data changes
Creates `Document` (`id`, `applicationId` as its one owning context, `documentType`, secure storage reference, `uploadedByUserId`, status [`ACTIVE`/`SUPERSEDED`/`ARCHIVED`], timestamps). No file content is stored in PostgreSQL.

### UX and accessibility
File Upload component (`docs/ux/component-guidelines.md`) with a standard file picker as a first-class control — drag-and-drop, if offered, is never the only way to upload, per `docs/ux/accessibility.md` — visible upload progress, accessible error messages, screen-reader upload-progress and completion announcements, Loading/Error/Success/Disabled states.

### Tests
- Unit: file type/size validation; document status transitions (`ACTIVE` → `SUPERSEDED` → `ARCHIVED`).
- Integration: authorized-upload issuance and completion confirmation write a `Document` scoped to the correct `Application`; ownership-denied access attempts are rejected.
- Component: upload widget Loading/Error/Success states; keyboard operability without relying on drag-and-drop.
- E2E: an applicant uploads a required document and sees the checklist update.

### Out of scope
Reviewer-facing document viewing UI (2.7/2.8), configuration of which document types are required (future Operations/administration tooling), malware/virus scanning pipeline internals.

### Dependencies
2.3 (`Application` as the owning context); 1.5 (authorization). The secure object storage provider is an implementation detail behind a `DocumentService` and is tracked as an open item in `docs/planning/assumptions.md` ("Document storage provider"); it does not block this story's scope, only its final infrastructure choice.

---

## Story 2.5 — Submit application

### Status
Done

### User story
As an applicant, I want to submit my completed application, so that Nova Operations can begin reviewing it.

### Scope
- Explicit Submit action (Server Action), enabled only when the `Application` is `DRAFT` and all required fields and required documents (2.4) are complete.
- Full completeness validation at submit time, stricter than the lenient validation used for draft saves (2.3).
- Transition `DRAFT` → `SUBMITTED`, stamp `submittedAt`, and freeze applicant editing of submitted content (later "more information needed" requests are Operations-initiated within eligibility review, 2.8, not a reopening of the form).
- Plain-language, on-screen confirmation of what happens next, per `docs/ux/content-style-guide.md`; this story does not add an email or messaging notification (messaging is deferred, `docs/decisions/ADR-012-messaging-v2.md`; advanced notifications are deferred per `docs/product/mvp.md`).

### Acceptance criteria
1. Given a `DRAFT` `Application` with all required fields and required documents complete, when the applicant submits, then the `Application` transitions to `SUBMITTED`, `submittedAt` is recorded, and the record becomes visible in the Operations queue (2.7).
2. Given a `DRAFT` `Application` missing required fields or required documents, when submission is attempted, then it is blocked with specific, field-level messages identifying exactly what is missing.
3. Given a successful submission, when confirmed, then the applicant sees a plain-language, respectful confirmation of what happens next, and the submitted content becomes read-only to the applicant outside of the simplified journey view (2.6).
4. Given an `Application` that is not `DRAFT` (already submitted, or terminal), when a submit action is attempted again — for example, a stale tab or a replayed request — then it is rejected as a lifecycle error and no duplicate submission is created.
5. Given the submit action executes, when it completes, then the status change and its audit/lifecycle event are written in a single transaction, so no partial submission can occur.
6. Given a concurrent edit (two open tabs), when one tab submits and the other later attempts a stale draft save, then the stale write is rejected with the Concurrent update state, never silently overwritten.

### Authorization
Permission `application.submit`, ownership-scoped to the applicant's own `Application`, lifecycle-gated to `DRAFT` only.

### Lifecycle rules
`DRAFT` → `SUBMITTED` is the only transition this story performs. Establishes that once submitted, the applicant cannot freely edit form content; only an Operations-initiated request for more information (2.8) or a document upload/replacement (2.4) can add information afterward.

### Data changes
Updates `Application.status` and `submittedAt`; writes the associated lifecycle/audit event.

### UX and accessibility
The Submit control shows a Disabled state (with the reason) until required items are complete, an inline checklist highlights missing items, the success confirmation is announced to assistive technology, mobile-first sticky submit action, respectful confirmation copy.

### Tests
- Unit: completeness validation; the `DRAFT`-only lifecycle guard.
- Integration: transactional status transition with its audit event; concurrency/staleness handling.
- Component: the Submit control's disabled/enabled states, missing-items checklist, success confirmation.
- E2E: an applicant completes a draft, uploads required documents, submits, and sees confirmation; a duplicate/replayed submit results in exactly one `SUBMITTED` application.

### Out of scope
Eligibility review itself (2.8), post-submission edit or more-information requests (2.8), email/notification delivery.

### Dependencies
2.3, 2.4 (required documents must be uploadable and complete), 1.5.

---

## Story 2.6 — View participant-safe application journey

### Status
Done

### User story
As an applicant, I want to see a clear, simplified view of where my application stands and what happens next, so that I always know whether action is needed from me.

### Scope
- Build the My Application screen in the `(participant)` shell (1.7), built around the Journey Timeline and Next Step Card components — the Journey Timeline is Project Nova's signature component (`docs/ux/visual-design-reference.md`, `docs/ux/component-guidelines.md`).
- Map the full internal `Application` status (2.3's enum) to a small set of simplified, respectful, participant-safe stages — for example, collapsing `ELIGIBILITY_REVIEW`, `INTERVIEW`, and `BACKGROUND_REVIEW` into a single "Under review" stage with a next-step note — consistent with the UX principle in `docs/product/participant-lifecycle.md`: "The participant sees a simplified journey and a clear current step, not the full internal operational complexity."
- Surface an explicit "no action needed right now" state and a "we need one more document" state when applicable, per `docs/ux/content-style-guide.md`.
- Show the applicant's current/active `Application` distinctly from any prior terminal applications (reapplication history).
- Never render restricted content: no `EligibilityReview` rationale, `Interview` notes, `BackgroundReview` detail, or internal case notes.

### Acceptance criteria
1. Given an applicant with a `DRAFT` `Application`, when they view My Application, then they see a "Continue Application" next step that resumes the draft (2.3).
2. Given an `Application` in `SUBMITTED`, `ELIGIBILITY_REVIEW`, `INTERVIEW`, or `BACKGROUND_REVIEW`, when the applicant views their journey, then internal phase detail is presented only as one of a small set of simplified, respectful stages, and no restricted content is ever included in the response payload.
3. Given an `Application` reaches `REJECTED` or `DISQUALIFIED`, when displayed, then the copy uses approved respectful language — never "failed," a clinical "rejected," or "bad candidate" — and states plainly whether reapplication is possible, per `docs/ux/content-style-guide.md`.
4. Given an `Application` reaches `ACCEPTED`, when displayed, then the journey reflects acceptance and directs the participant toward onboarding (Epic 3), without exposing internal review notes.
5. Given an applicant with more than one `Application` (reapplication), when viewing their journey, then the current/active application is shown clearly, separate from prior terminal applications.
6. Given a screen-reader user, when the current step changes on revisit, then the change is announced, per `docs/ux/accessibility.md`.

### Authorization
Permission `application.view`, ownership-scoped to the applicant's own `Person` — never reachable for another person's application, and never trusting a client-supplied application ID without a server-side ownership check.

### Lifecycle rules
Read-only projection of the `Application` lifecycle into a simplified, participant-safe status. This story performs no transitions.

### Data changes
None new. Reads `Application` and its derived/mapped simplified status, and `Document` checklist metadata (not contents) for "missing document" prompts. Uses a dedicated participant-safe view model that structurally excludes `EligibilityReview`, `Interview`, and `BackgroundReview` detail and any case notes — not a filtered version of the internal workspace query.

### UX and accessibility
Journey Timeline and Next Step Card components, plain language, text-and-icon status (never color alone), mobile-first, screen-reader transition announcements, respectful terminal-state copy.

### Tests
- Unit: the internal-status-to-simplified-stage mapping, exhaustive over the full enum, verifying no restricted phase or field ever appears in the mapped output.
- Integration: the participant-safe view model excludes `EligibilityReview`/`Interview`/`BackgroundReview`/case-note fields at the query level, not just in the UI.
- Component: the timeline renders each simplified stage and terminal copy correctly, with accessible status announcements.
- E2E: an applicant's journey view updates correctly from draft through submission, using test doubles for the Operations-side outcomes that drive later stages.

### Out of scope
The internal Application Workspace (2.7), editing at this stage, notifications.

### Dependencies
2.3 (introduces the full status enum this story maps), 2.5. Consumes outcomes written by 2.7–2.11 without depending on their UI, so it can be built in parallel with the Operations-side stories.

---

## Story 2.7 — Operations applications queue

### Status
Done

### User story
As a Program Coordinator, I want a queue of applications and a workspace for each one, so that I can see what needs attention and work an application through review.

### Scope
- Applications queue: a list view filterable/sortable by `Application.status`, surfacing `SUBMITTED` and in-review applications first, consistent with the Operations dashboard's Today's Work / Urgent blockers pattern (`docs/ux/wireframes-layouts.md`).
- Application Workspace shell: entity header, full internal journey progress (unlike 2.6's simplified view, this shows the real `Application.status` and phase history to authorized staff), and tabs — Overview, Documents, Eligibility, Interview, Background, History — per `docs/ux/wireframes-layouts.md`.
- Contextual actions appropriate to the current phase (Begin Eligibility Review, Schedule Interview, Record Background Decision, Accept, Reject) are surfaced here as entry points; their mechanics are specified in 2.8–2.11.
- Internal notes: a minimal `CaseNote` capability scoped to the `Application` (one of its XOR owning contexts, per `docs/architecture/database-design.md`), visible only within Nova Operations.
- Gate the Background tab specifically: a Program Coordinator without the restricted background permission sees that the tab exists but not its contents.

### Acceptance criteria
1. Given a Program Coordinator with `application.view`, when they open the Applications queue, then they see applications scoped to Nova, filterable by status, with `SUBMITTED` and in-review applications surfaced first.
2. Given an application selected from the queue, when opened, then the Application Workspace renders the entity header, full internal journey progress, and the Overview, Documents, Eligibility, Interview, Background, and History tabs.
3. Given a Program Coordinator without `backgroundReview.view`, when they open the Background tab, then background review content is hidden behind the Restricted state — not rendered, and not present in the payload sent to the client.
4. Given a user holding `backgroundReview.view` (for example, the optional Restricted Review Specialist role, or another role explicitly granted that permission), when they open the Background tab, then the content is visible and the access is written to an audit event.
5. Given a user without Nova organization membership or `application.view`, when they attempt to reach the queue or a workspace directly by URL, then access is denied with the Permission denied state and no application data is present in the response.
6. Given an internal note is added in the workspace, when saved, then it is visible only within Nova Operations views — never surfaced to the participant's journey (2.6) or to any shelter experience.

### Authorization
`application.view` for the queue and the non-restricted parts of the workspace, scoped to active Nova organization membership (Program Coordinator or higher). `backgroundReview.view` is a separate, restricted permission gating the Background tab specifically — not implied by any base role — consistent with `docs/architecture/authorization-rbac.md`'s example that "a coordinator may not view detailed background data without explicit restricted permission." `caseNote.create` gates adding internal notes, same organization scope.

### Lifecycle rules
This story is a read/navigation surface; it does not transition the `Application`. It displays the full lifecycle, including History (the lifecycle/audit event trail), which is exactly what 2.6 deliberately does not show.

### Data changes
Introduces `CaseNote` (`id`, `applicationId` as one valid XOR owning context, `authorId`, body, timestamps) for the workspace's internal notes. No other new persisted fields beyond what 2.3–2.5 already created.

### UX and accessibility
Accessible tabs pattern (roving tabindex, ARIA tab roles), a Blocker List for urgent items, a dense desktop-optimized layout per the Operations principle in `docs/ux/ux-spec.md` while still built on the mobile-first baseline, and a Restricted state that is visually and semantically distinct from Permission denied — both conveyed with text and icon, never color alone.

### Tests
- Unit: queue filter/sort logic; restricted-tab visibility resolution given a permission set.
- Integration: organization-scope enforcement; restricted fields are excluded from the payload for unauthorized users; an audit event is written on restricted access.
- Component: tabs render correctly; Restricted vs. Permission denied states are distinguishable without color.
- E2E: a coordinator without the restricted permission cannot see background detail even via a direct URL; a coordinator with the permission can, and the access is audited.

### Out of scope
The review actions themselves (2.8–2.11), reporting/analytics (Epic 7), full case-note authoring beyond the minimal internal-notes need.

### Dependencies
2.5 (applications must reach `SUBMITTED` to populate the queue), 1.5, 1.7 (operations protected layout).

---

## Story 2.8 — Eligibility review

### Status
Ready for Development

### User story
As a Program Coordinator, I want to record an eligibility determination on a submitted application, so that only applicants who meet Nova's eligibility criteria advance toward an interview.

### Scope
- Begin Eligibility Review action, transitioning `Application.status` from `SUBMITTED` to `ELIGIBILITY_REVIEW`.
- Record an eligibility outcome — Eligible or Not Eligible — with an internal rationale, using the Eligibility Checklist component (`docs/ux/component-guidelines.md`).
- Eligible advances the `Application` to `INTERVIEW` (2.9). Not Eligible invokes the shared rejection action (2.11) with an eligibility reason category, rather than duplicating rejection mechanics here.
- The eligibility rubric and screening model are governed by `docs/decisions/ADR-015-eligibility-screening-policy.md` (working policy): intake eligibility does not screen offense history; offense screening is individualized (case-by-case), never categorical. The workflow must not run against real applicants until the counsel-review launch gate clears (`docs/ops/launch-checklist.md`).

### Acceptance criteria
1. Given a `SUBMITTED` `Application`, when a Program Coordinator with `eligibilityReview.decide` begins eligibility review, then the `Application` transitions to `ELIGIBILITY_REVIEW` and an `EligibilityReview` record is created capturing the reviewer and start time.
2. Given an eligibility review in progress, when the coordinator records an Eligible outcome, then the `Application` transitions to `INTERVIEW` and the outcome and rationale are stored on the `EligibilityReview` record.
3. Given an eligibility review in progress, when the coordinator records a Not Eligible outcome, then the shared rejection action (2.11) is invoked with an eligibility reason category, and the `Application` does not advance to `INTERVIEW`.
4. Given the criteria used to reach a determination, when applied, then they must be the working eligibility policy in `ADR-015` — the intake rubric with reason categories drawn from it, never an offense-based category. Until the counsel-review launch gate clears, the action runs against synthetic data only, never real applicants.
5. Given an eligibility determination is recorded, when saved, then it is stored as an internal operational record, never exposed to the applicant beyond the simplified mapping in 2.6, and never exposed to shelters.
6. Given a user without `eligibilityReview.decide` or without Nova organization scope, when they attempt the action, then it is denied.

### Authorization
`eligibilityReview.decide`, Nova organization scope — a standard Program Coordinator permission; eligibility review is not itself restricted-tier the way background review is. Lifecycle-gated: `SUBMITTED` to begin, `ELIGIBILITY_REVIEW` to record an outcome.

### Lifecycle rules
`SUBMITTED` → `ELIGIBILITY_REVIEW` → (`INTERVIEW` or rejected via 2.11). Only a Nova Operations action drives this transition; the applicant has no control over it once submitted.

### Data changes
Creates `EligibilityReview` (`id`, `applicationId`, `reviewerId`, outcome [`ELIGIBLE`/`NOT_ELIGIBLE`], rationale, timestamps) as a record within the `Application` aggregate.

### UX and accessibility
Eligibility Checklist and Status Transition Control components, internal-only visibility, an accessible outcome-and-rationale form. The checklist items render the `ADR-015` intake rubric.

### Tests
- Unit: the `SUBMITTED`-only entry guard and outcome-to-transition mapping.
- Integration: `EligibilityReview` creation; permission/scope enforcement; exclusion from participant- and shelter-facing views.
- Component: the outcome-recording form and its accessible validation.
- E2E: a coordinator begins review on a synthetic submitted application, records an outcome against the `ADR-015` rubric, and the status transitions correctly. Synthetic fixtures only.

### Out of scope
Changing the eligibility rubric itself (governed by `ADR-015`; changes require a superseding ADR), interview scheduling (2.9), background review (2.10), the rejection UI/action itself (2.11).

### Dependencies
2.7 (queue/workspace surface), 2.5 (`SUBMITTED` applications to review). Criteria governed by `docs/decisions/ADR-015-eligibility-screening-policy.md` (working policy; production enablement gated on counsel review, `docs/ops/launch-checklist.md`).

---

## Story 2.9 — Interview workflow

### Status
Ready for Development

### User story
As a Program Coordinator, I want to schedule an interview and record its outcome, so that eligible applicants who are a good fit advance toward a background review.

### Scope
- Schedule Interview action for an `Application` in `INTERVIEW` status: date/time, format (for example, in person or virtual), and interviewer, using the Interview Appointment component (`docs/ux/component-guidelines.md`).
- Support rescheduling, preserving history rather than silently overwriting the prior time.
- Record an interview outcome after it occurs — Advance or Do Not Advance — with internal notes.
- Advance transitions the `Application` to `BACKGROUND_REVIEW` (2.10). Do Not Advance invokes the shared rejection action (2.11) with an interview reason category.
- Surface the scheduled appointment (date/time/format) to the applicant's journey view (2.6) as an upcoming event; interviewer notes and the recommendation stay internal.

### Acceptance criteria
1. Given an `Application` in `INTERVIEW` status, when a Program Coordinator with `interview.schedule` schedules an interview, then an `Interview` record is created with date/time, format, and interviewer, and the applicant sees the appointment in their journey view (2.6).
2. Given a scheduled interview, when the coordinator reschedules it, then the prior time is preserved in history, not discarded, and the applicant sees the updated time.
3. Given an interview has occurred, when the coordinator records an Advance outcome (`interview.record`), then the `Application` transitions to `BACKGROUND_REVIEW` and the outcome and notes are stored on the `Interview` record.
4. Given an interview has occurred, when the coordinator records a Do Not Advance outcome, then the shared rejection action (2.11) is invoked with an interview reason category, and the `Application` does not advance to `BACKGROUND_REVIEW`.
5. Given interview notes and the recommendation, when stored, then they are internal-only — never exposed to the applicant or to a shelter.
6. Given a user without `interview.schedule`/`interview.record` or without Nova organization scope, when they attempt to schedule or record an outcome, then the action is denied.

### Authorization
`interview.schedule` and `interview.record`, Nova organization scope, lifecycle-gated to `INTERVIEW` status.

### Lifecycle rules
`Application.status` remains `INTERVIEW` while an interview is scheduled or pending an outcome; it transitions to `BACKGROUND_REVIEW` only through the explicit Advance outcome, or to rejection through 2.11.

### Data changes
Creates `Interview` (`id`, `applicationId`, `scheduledAt`, `format`, `interviewerId`, outcome [`ADVANCE`/`DO_NOT_ADVANCE`, null until recorded], notes, timestamps).

### UX and accessibility
Interview Appointment component, an accessible date/time input that is not drag-and-drop-only (`docs/ux/accessibility.md`), a clear visual and semantic distinction between "scheduled" and "outcome recorded," respectful applicant-facing appointment copy, and a screen-reader announcement when an appointment is scheduled or changed.

### Tests
- Unit: the `INTERVIEW`-only lifecycle guard; outcome-to-transition mapping; reschedule history preservation.
- Integration: `Interview` creation/update; permission and scope enforcement; notes are excluded from the participant-facing payload.
- Component: the scheduling form, the outcome-recording form, and the applicant-facing appointment card.
- E2E: a coordinator schedules an interview, the applicant sees it, the coordinator records Advance, and the application reaches `BACKGROUND_REVIEW`.

### Out of scope
Video-conferencing integration, calendar sync or reminder notifications (messaging is deferred), background review itself (2.10).

### Dependencies
2.8 (the application must reach `INTERVIEW` via an eligible outcome), 2.7.

---

## Story 2.10 — Background decision workflow

### Status
Ready for Development

### User story
As an authorized restricted reviewer, I want to record the outcome of an applicant's background check, so that only applicants who clear it can be accepted, while keeping the details away from anyone without clearance.

### Scope
- Record Background Decision action for an `Application` in `BACKGROUND_REVIEW` status: outcome (Clear or Disqualifying) and a restricted rationale.
- Gate the entire capability — viewing and deciding — behind a restricted permission that is not implied by any base role, including Program Coordinator; per `docs/architecture/authorization-rbac.md`, "a coordinator may not view detailed background data without explicit restricted permission."
- MVP records the outcome of a background check conducted through an external process; it does not integrate with a background-check vendor or API (background-check integration is explicitly deferred, `docs/product/mvp.md`).
- A Clear outcome makes the `Application` eligible for the Accept action (2.11) but does not auto-accept it. A Disqualifying outcome invokes the shared rejection action (2.11) with a background reason category.
- Treat background report content and rationale as Highly Restricted: never logged, and excluded from every view model except the restricted internal one.

### Acceptance criteria
1. Given an `Application` in `BACKGROUND_REVIEW`, when a user holding `backgroundReview.decide` records that a background check is complete, then a `BackgroundReview` record is created capturing the reviewer, timestamp, and outcome.
2. Given a Program Coordinator without `backgroundReview.decide` (or `backgroundReview.view`), when they attempt to view or record a background decision, then both the action and the underlying data are denied server-side — not merely hidden in the UI.
3. Given a Clear outcome, when recorded, then the `Application` becomes eligible for the Accept action (2.11) but is not itself automatically accepted.
4. Given a Disqualifying outcome, when recorded, then the shared rejection action (2.11) is invoked with a background reason category. Whether it is an ordinary rejection or permanent disqualification follows `ADR-016`: only an active PERMANENT court-ordered animal-possession ban qualifies from this path; a time-limited ban is an ordinary rejection with reapplication possible after the ban lapses.
5. Given a background decision is recorded, when stored, then its rationale and any report content are held at the Highly Restricted classification, excluded from logs, and excluded from every role-shaped view model except the restricted internal one.
6. Given a background decision is recorded, when saved, then the action is written to an audit event distinct from ordinary lifecycle events, reflecting its sensitivity.

### Authorization
`backgroundReview.view` and `backgroundReview.decide` — a restricted permission tier, distinct from and not implied by standard Program Coordinator permissions, typically held by the optional Restricted Review Specialist role or another role explicitly granted it. The full evaluation sequence applies, including the restricted-permission check before any background data loads.

### Lifecycle rules
`BACKGROUND_REVIEW` → (accept-eligible, pending 2.11) or → rejected via 2.11 (possibly permanently disqualifying). There is no auto-transition to `ACCEPTED` — acceptance remains a distinct, explicit action even after a Clear outcome, consistent with lifecycle transitions being action-based, not automatic.

### Data changes
Creates `BackgroundReview` (`id`, `applicationId`, `reviewerId`, outcome [`CLEAR`/`DISQUALIFYING`], restricted rationale, timestamps). No external vendor/report data model is introduced in MVP — this records a decision reached through an external process, not the check itself.

### UX and accessibility
The Restricted state is the default rendering for any user without the permission (distinct from Permission denied — Restricted specifically means "this exists, but you lack clearance," per `docs/ux/wireframe-spec.md`); an accessible, unambiguous confirmation step before recording a high-stakes, largely irreversible outcome; status conveyed with text and icon, never color alone.

### Tests
- Unit: the restricted-permission gate (deny by default); the `BACKGROUND_REVIEW`-only lifecycle guard.
- Integration: `BackgroundReview` data is excluded from non-restricted view models and from logs; an audit event is written on every access and decision.
- Component: the Restricted state renders correctly for unauthorized roles.
- E2E: the restricted permission gate allows a Restricted Review Specialist and denies a coordinator; a specialist records a synthetic outcome and the application transitions correctly. Synthetic fixtures only.

### Out of scope
Background-check vendor/API integration (explicitly deferred, `docs/product/mvp.md`), the acceptance/rejection action itself (2.11), an appeals process.

### Dependencies
2.9 (the application must reach `BACKGROUND_REVIEW`), 1.5 (restricted-permission support). Legal obligations and the disqualification linkage are governed by `docs/decisions/ADR-015-eligibility-screening-policy.md` and `docs/decisions/ADR-016-rejection-disqualification-policy.md` (working policy; production enablement gated on counsel review, `docs/ops/launch-checklist.md`).

---

## Story 2.11 — Acceptance and rejection

### Status
Ready for Development

### User story
As a Program Coordinator, I want to accept or reject an application with a single, auditable decision action, so that the outcome is recorded consistently and the applicant is told respectfully and correctly what it means for them.

### Scope
- Accept action: reachable only when `Application.status` is `BACKGROUND_REVIEW` with a recorded Clear outcome (2.10). Transitions the `Application` to `ACCEPTED` and, in the same operation, triggers the transactional creation of the `Participant` and `Program Enrollment` records specified in Story 3.1 (`docs/stories/epic-3-enrollment-training.md`) — the acceptance and the participant/enrollment creation succeed together or not at all, per `docs/product/business-rules.md`: "Accepted application creates participant and enrollment records transactionally."
- Reject action: the single, shared rejection mechanism invoked by this story directly, or by 2.8/2.9/2.10 on a negative outcome, with a reason category. Transitions the `Application` to `REJECTED` (ordinary — reapplication allowed 30 days after `decidedAt`, `ADR-016`) or `DISQUALIFIED` (permanent — blocks future applications; only the three `ADR-016` categories qualify).
- The 30-day reapplication window is enforced at the application gateway (2.3's `resolveApplicationGateway`/`startOrResumeApplication`), which shows the reapply date in respectful copy — never an error — until the window elapses.
- Applicant-facing copy for both outcomes is drawn only from the approved templates in `docs/ux/content-style-guide.md` ("Decision communications", `ADR-016`): never "failed," "bad candidate," or a clinical "rejected"; the reapply date stated plainly when reapplication remains possible.
- The permanent-disqualification branch is governed by `ADR-016` (three narrow categories: active permanent animal-possession ban; violence within the program; fraud against the program). Until the counsel-review launch gate clears, this branch runs against synthetic data only, never real applicants.

### Acceptance criteria
1. Given an `Application` in `BACKGROUND_REVIEW` with a Clear `BackgroundReview` outcome, when a user with `application.accept` accepts it, then the `Application` transitions to `ACCEPTED` and, within the same transaction boundary, Story 3.1's `Participant` and `Program Enrollment` creation is triggered — both succeed or neither does.
2. Given an `Application` at any non-terminal phase, when a user with `application.reject` rejects it with an ordinary (non-disqualifying) reason, then the `Application` transitions to `REJECTED`, the applicant may submit a new application 30 days after `decidedAt` (`ADR-016`; enforced at the 2.3 gateway, which shows the reapply date respectfully before then), and the applicant-facing copy uses the approved templates in `docs/ux/content-style-guide.md`.
3. Given a rejection reason in one of `ADR-016`'s three permanent-disqualification categories, when recorded, then the `Application` transitions to `DISQUALIFIED` and a disqualification flag is set on the `Person` so future application attempts are blocked at creation (2.3), with applicant-facing copy drawn only from the approved disqualification template. Until the counsel-review launch gate clears, this transition runs against synthetic data only.
4. Given a rejection or disqualification is recorded, when the applicant views their journey (2.6), then they see only approved, respectful language — never unapproved permanent-disqualification wording.
5. Given an Accept or Reject action is attempted outside its required state — for example, accepting a `DRAFT` application, or acting on an `Application` that is already `ACCEPTED`, `REJECTED`, or `DISQUALIFIED` — then it is rejected as a lifecycle error.
6. Given an Accept or Reject action completes, when recorded, then it is written to an audit event capturing who decided, when, and the reason category.

### Authorization
`application.accept` requires Nova organization scope and a business prerequisite beyond lifecycle state — a recorded Clear `BackgroundReview` outcome (2.10) — checked in the "business prerequisites" step of the evaluation sequence, not just status. `application.reject` requires Nova organization scope and is callable from any non-terminal phase. Neither permission is available to shelters or to the applicant themselves.

### Lifecycle rules
Owns the terminal transitions `BACKGROUND_REVIEW` → `ACCEPTED`, and {any non-terminal status} → `REJECTED` or `DISQUALIFIED`. `ACCEPTED`, `REJECTED`, and `DISQUALIFIED` are all terminal — terminal applications are never reopened (`docs/product/business-rules.md`). The `ACCEPTED` transition is the trigger boundary for Epic 3, Story 3.1; this story does not itself create `Participant` or `Program Enrollment` records — it hands off to 3.1's transaction.

### Data changes
Updates `Application.status` to a terminal value, `decidedAt`, and `decisionReason`. On `ACCEPTED`, hands off to Story 3.1 to create `Participant` and `Program Enrollment`. On `DISQUALIFIED`, sets a permanent-disqualification marker on `Person` (not just the `Application`), since the block must survive to future application attempts by the same person.

### UX and accessibility
Application Decision component and a Confirmation Panel for this largely irreversible decision (an accessible confirm/cancel pattern, never a bare browser confirmation dialog), text-and-icon status badges, and applicant-facing copy drawn only from an approved template — never free text shown verbatim to the applicant.

### Tests
- Unit: accept/reject/disqualify lifecycle guards; terminal-state immutability.
- Integration: the transactional Accept → participant/enrollment handoff (paired with 3.1's own tests); the audit event written on every decision; the `Person`-level disqualification flag blocking future application creation (2.3).
- Component: the decision confirmation UI and respectful-copy rendering.
- E2E: the full happy path (draft → submit → eligible → interview advance → background clear → accept) reaches the 3.1 handoff; the ordinary-rejection path shows the approved messaging with the reapply date, blocks a new application inside the 30-day window, and allows one after it; the disqualification path (synthetic fixtures) blocks at creation with the approved template.

### Out of scope
`Participant`/`Program Enrollment` record creation itself (Epic 3, Story 3.1), onboarding (Epic 3), an appeals process, notification/email delivery.

### Dependencies
2.10 (a Clear outcome is required to accept); 2.8/2.9 (rejection may be invoked from any prior phase); Epic 3, Story 3.1, for the participant/enrollment creation this story triggers. Disqualification criteria, the 30-day reapplication window, and applicant-facing wording are governed by `docs/decisions/ADR-016-rejection-disqualification-policy.md` (working policy; production enablement gated on counsel review, `docs/ops/launch-checklist.md`).
