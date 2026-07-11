import { NextResponse } from "next/server";

import { requireAuthContext } from "@/server/auth/context";
import { authorizeOperation } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import { toErrorResponse } from "@/server/errors/http";

/**
 * Organization summary (Story 1.5) — the first fully-guarded endpoint,
 * exercising the complete evaluation sequence end-to-end: authenticate →
 * resolve user → resolve memberships → permission → load → scope →
 * lifecycle → shaped result. Cross-organization requests are denied.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const ctx = await requireAuthContext();
    const { organizationId } = await params;

    const organization = await authorizeOperation({
      ctx,
      permission: "organization.view",
      loadResource: () =>
        prisma.organization.findUnique({
          where: { id: organizationId },
          include: { _count: { select: { memberships: true } } },
        }),
      resourceOrganizationId: (org) => org.id,
      lifecycle: (org) => ({ current: org.status, allowed: ["ACTIVE"] }),
    });

    // Shaped result — no raw Prisma record, no timestamps, no flags.
    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      kind: organization.kind,
      memberCount: organization._count.memberships,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
