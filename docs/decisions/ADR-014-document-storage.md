# ADR-014 — Document storage on Vercel Blob

## Status
Accepted

## Decision
Application documents are stored in Vercel Blob behind a `DocumentService`. A nonproduction store serves local and preview (mirroring ADR-006's shared-nonproduction pattern); a separate production store is created at launch (gated in `docs/ops/launch-checklist.md`). Uploads use the authorized-upload pattern from `docs/architecture/api-service-design.md`: a Route Handler authorizes and issues a short-lived upload token, the file transfers directly to storage (bytes never proxy through a Server Action), and a client-called confirm Route Handler verifies the stored object server-side and creates the `Document` metadata record. PostgreSQL holds metadata only.

## Rationale
Blob rides the Vercel account and environment scoping the project already uses — no new vendor, and store-to-environment mapping matches the existing separation rules. Its client-upload flow implements the documented authorized-upload pattern directly. The confirm step is client-called (not Vercel's `onUploadCompleted` webhook) so the flow works identically in local, preview, and production. This resolves the "document storage provider" open item (`docs/planning/open-questions.md` #10).

## Security model
Document contents are Highly Restricted (`docs/architecture/security-privacy.md`). The store uses **private access**: objects are unreachable without server credentials even when a URL is known. Storage pathnames additionally get cryptographically random suffixes and are treated as server-side secrets — excluded from every view model and every log. All reads stream through an authorizing download Route Handler (ownership for applicants; `document.view` under Nova scope for Operations; shelters never), with `Cache-Control: no-store`. Uploads are confined by short-lived tokens to a per-application, per-type pathname prefix, and the confirm step re-verifies type and size against storage server-side.

## Consequences
Adds `@vercel/blob` and the `BLOB_READ_WRITE_TOKEN` environment variable (nonproduction token in `.env.local`/Preview; production token at launch). Adds "Production Blob store configured" to the launch checklist. This decision is binding for MVP. Changes require a superseding ADR.
