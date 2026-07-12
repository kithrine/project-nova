import { get } from "@vercel/blob";
import type { NextRequest } from "next/server";

import { requireAuthContext } from "@/server/auth/context";
import { NotFoundError } from "@/server/errors/app-error";
import { toErrorResponse } from "@/server/errors/http";
import { authorizeDownload } from "@/server/services/document-service";

/**
 * Authorized document download (Story 2.4, ADR-014). The store is PRIVATE:
 * objects are unreachable without server credentials, and this handler is
 * the only read path — authorization first (owner, or Operations reviewer
 * with document.view under Nova scope; shelters never), then the file
 * streams through with no-store caching.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const ctx = await requireAuthContext();
    const { documentId } = await params;
    const { storagePathname, fileName, contentType } = await authorizeDownload(
      ctx,
      documentId,
    );

    const result = await get(storagePathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new NotFoundError();
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName.replace(/[^\w.\- ]/g, "_")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
