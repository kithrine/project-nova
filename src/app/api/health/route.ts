import { NextResponse } from "next/server";

import { prisma } from "@/server/database/prisma";

export const dynamic = "force-dynamic";

/**
 * Health check (Story 1.3). Route Handler per docs/architecture/api-service-design.md.
 * Reports database connectivity without exposing secrets, connection strings,
 * or error internals (docs/architecture/coding-standards.md).
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch {
    // Never leak error details or stack traces through the boundary.
    return NextResponse.json(
      { status: "degraded", database: "unavailable" },
      { status: 503 },
    );
  }
}
