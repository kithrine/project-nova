import type { AuthContext } from "@/server/auth/context";
import { prisma } from "@/server/database/prisma";

/**
 * Audit events (Story 2.7; docs/architecture/security-privacy.md). Records
 * WHO accessed or performed something sensitive, distinct from lifecycle
 * events, which record what happened to a workflow record (architecture.md).
 * Append-only; the record itself carries no sensitive content — only the
 * action code and the subject reference, so the trail is safe to review.
 */
export async function recordAuditEvent(
  ctx: AuthContext,
  action: string,
  subjectType: string,
  subjectId: string,
): Promise<void> {
  await prisma.auditEvent.create({
    data: { actorUserId: ctx.userId, action, subjectType, subjectId },
  });
}
