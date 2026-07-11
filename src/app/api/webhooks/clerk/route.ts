import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  mapClerkUserPayload,
  provisionClerkUser,
  type ClerkUserPayload,
} from "@/server/services/user-provisioning";

/**
 * Clerk provisioning webhook (Story 1.2).
 * - Signature is verified (svix) before anything is read — unsigned or
 *   invalidly signed payloads are rejected and nothing is written.
 * - Processing is idempotent: replayed events update, never duplicate.
 * - user.deleted is intentionally not handled: deletion/retention policy is
 *   an open question (docs/planning/open-questions.md #7) and users are
 *   never hard-deleted through normal workflows (RULES.md).
 */
export async function POST(req: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(req);
  } catch {
    // Never trust unsigned payloads; no details leak in the response.
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const mapped = mapClerkUserPayload(event.data as unknown as ClerkUserPayload);
    if (mapped) {
      await provisionClerkUser(mapped);
    }
  }

  return NextResponse.json({ received: true });
}
