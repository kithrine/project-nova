import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { DocumentType } from "@/generated/prisma/client";
import { requireAuthContext } from "@/server/auth/context";
import { ValidationError } from "@/server/errors/app-error";
import { toErrorResponse } from "@/server/errors/http";
import {
  confirmCertificationUpload,
  confirmUpload,
} from "@/server/services/document-service";

const applicationConfirmSchema = z.object({
  applicationId: z.string().min(1),
  documentType: z.enum(DocumentType),
  pathname: z.string().min(1),
  fileName: z.string().trim().min(1).max(200),
});

const certificationConfirmSchema = z.object({
  certificationId: z.string().min(1),
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
    const body: unknown = await request.json();

    // Certification attachments (3.5) carry certificationId; application
    // documents (2.4) carry applicationId + documentType. XOR by shape.
    const certification = certificationConfirmSchema.safeParse(body);
    if (certification.success) {
      return NextResponse.json(
        await confirmCertificationUpload(ctx, certification.data),
      );
    }
    const application = applicationConfirmSchema.safeParse(body);
    if (application.success) {
      return NextResponse.json(await confirmUpload(ctx, application.data));
    }
    throw new ValidationError();
  } catch (error) {
    return toErrorResponse(error);
  }
}
