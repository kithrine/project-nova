import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { DocumentType } from "@/generated/prisma/client";
import { requireAuthContext } from "@/server/auth/context";
import { ValidationError } from "@/server/errors/app-error";
import { toErrorResponse } from "@/server/errors/http";
import { confirmUpload } from "@/server/services/document-service";

const confirmSchema = z.object({
  applicationId: z.string().min(1),
  documentType: z.enum(DocumentType),
  pathname: z.string().min(1),
  fileName: z.string().trim().min(1).max(200),
});

/**
 * Upload confirmation (Story 2.4): verifies the stored object server-side
 * (prefix ownership, real content type and size from storage) and creates
 * the Document metadata record, superseding any prior ACTIVE document of
 * the same type. Idempotent per storage pathname.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const parsed = confirmSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError();
    }
    const view = await confirmUpload(ctx, parsed.data);
    return NextResponse.json(view);
  } catch (error) {
    return toErrorResponse(error);
  }
}
