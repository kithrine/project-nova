import Link from "next/link";

import { PermissionDenied } from "@/components/feedback/permission-denied";
import { AuditReview } from "@/features/administration/audit-review";
import { AuthorizationError } from "@/server/errors/app-error";
import { getAuthContext } from "@/server/auth/context";
import { listAuditEvents } from "@/server/services/audit-service";

export const metadata = { title: "Audit review" };

const BASE_PATH = "/operations/administration/audit";

/**
 * Audit review (Story 7.6) — itself a privileged, restricted surface:
 * `audit.view` is held by the Nova Administrator and Grant Administrator
 * only, so even coordinators land on Permission denied here.
 */
export default async function AuditReviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    actor?: string;
    action?: string;
    subjectType?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) return <PermissionDenied />;

  const params = await searchParams;
  let view;
  try {
    view = await listAuditEvents(ctx, {
      actorUserId: params.actor,
      action: params.action,
      subjectType: params.subjectType,
      from: params.from,
      to: params.to,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return <PermissionDenied />;
    throw error;
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs">
          <Link
            href="/operations/administration"
            className="underline underline-offset-2"
          >
            Administration
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Audit review</h1>
        <p className="max-w-prose text-sm text-base-content/70">
          Who accessed or performed sensitive actions, when, and on what. The
          trail is append-only; entries reference records without exposing their
          contents.
        </p>
      </header>

      <AuditReview view={view} basePath={BASE_PATH} />
    </section>
  );
}
