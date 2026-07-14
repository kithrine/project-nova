import type { NextRequest } from "next/server";

import { requireAuthContext } from "@/server/auth/context";
import { toErrorResponse } from "@/server/errors/http";
import { runNamedExport } from "@/server/services/export-service";

/**
 * Named-export download (Story 7.5; ADR-021). The ONLY export path:
 * authorization and the fixed field allow-list live in the export
 * service, the audit event is written there, and the CSV streams
 * straight to the caller — nothing is stored. Denied callers get the
 * error response and no file exists anywhere.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ exportKey: string }> },
) {
  try {
    const ctx = await requireAuthContext();
    const { exportKey } = await params;
    const searchParams = request.nextUrl.searchParams;

    const result = await runNamedExport(ctx, exportKey, {
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });

    return new Response(result.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
