import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { DocumentType } from "@/generated/prisma/client";
import { requireAuthContext } from "@/server/auth/context";
import { AuthorizationError } from "@/server/errors/app-error";
import { toErrorResponse } from "@/server/errors/http";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_DOCUMENT_BYTES,
  authorizeUpload,
} from "@/server/services/document-service";

/**
 * Authorized-upload token issuance (Story 2.4, ADR-014). Authorization runs
 * BEFORE any token exists: ownership of the application, non-terminal
 * lifecycle, allowed types/size. The token confines the upload to this
 * user's authorized pathname prefix with a random suffix. File bytes go
 * directly to storage — never through this process.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const body = (await request.json()) as HandleUploadBody;

    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const parsed = JSON.parse(clientPayload ?? "{}") as {
          applicationId?: string;
          documentType?: string;
        };
        const documentType = parsed.documentType as DocumentType;
        const { pathnamePrefix } = await authorizeUpload(
          ctx,
          String(parsed.applicationId ?? ""),
          documentType,
        );
        // Private-store presigned flow: the CLIENT-requested pathname is what
        // gets signed (server overrides are not applied), so the authorization
        // binding is validation — the request must target the exact prefix
        // this user was authorized for.
        if (!pathname.startsWith(pathnamePrefix)) {
          throw new AuthorizationError();
        }
        return {
          addRandomSuffix: true,
          allowedContentTypes: [...ALLOWED_CONTENT_TYPES],
          maximumSizeInBytes: MAX_DOCUMENT_BYTES,
        };
      },
      // The record is created by the client-called confirm endpoint (works in
      // every environment; Vercel cannot call localhost). Nothing to do here.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
