# Content Style Guide

## Voice

Respectful, direct, calm, and professional.

## Participant language

Prefer:

- “Your application is under review.”
- “We need one more document.”
- “You may apply again.”
- “No action is needed right now.”

Avoid:

- “Failed”
- “Bad candidate”
- “Criminal”
- “Rejected permanently” without approved legal language
- Bureaucratic jargon

## Action labels

Use verbs:

- Continue Application
- Upload Document
- Review Placement
- Approve Hours
- Report Incident

Avoid vague labels such as “Submit” when a more specific action is possible.

## Decision communications (approved templates — ADR-016)

Applicant-facing copy for terminal decisions is drawn ONLY from these
templates (Story 2.11: never free text shown verbatim). Placeholders in
`{braces}` are filled by the system.

**Ordinary rejection (`REJECTED`):**

> Thank you for applying to Project Nova. After careful review, we aren't
> able to move your application forward right now. This decision isn't a
> judgment of you — our review looks at program fit at a single point in
> time, and circumstances change. You may apply again on or after
> {reapplyDate}, and a new application is always reviewed with fresh eyes.

**Rejection where a background report was considered** (append):

> This decision considered information from a background report. You
> received a copy of that report and a summary of your rights, and you can
> dispute its accuracy with {agencyName} and request a free copy within
> 60 days.

**Permanent disqualification (`DISQUALIFIED`):**

> Thank you for your interest in Project Nova. After careful review, a new
> application can't be started on this account. If you have questions or
> think this is a mistake, please contact Project Nova — we're glad to talk
> it through with you.

**Blocked reapplication (gateway, before the 30-day window elapses):**

> Your previous application was decided on {decidedDate}. You may start a
> new application on or after {reapplyDate} — we'd be glad to see it.

Rules: state plainly whether and when reapplication is possible; never use
"failed," "criminal," "bad candidate," or clinical "rejected" language;
never name an offense or background detail in applicant-facing copy.
