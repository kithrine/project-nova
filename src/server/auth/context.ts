import { auth } from "@clerk/nextjs/server";
import { cache } from "react";

import { prisma } from "@/server/database/prisma";
import { AuthenticationError } from "@/server/errors/app-error";
import { listActiveMembershipsForUser } from "@/server/repositories/membership-repository";
import type { MembershipView } from "@/server/repositories/types";

/**
 * Server-resolved authorization context (Story 1.5).
 *
 * Everything here comes from the Clerk session + Nova's own database —
 * NEVER from client-supplied user IDs, roles, organization IDs, or
 * permissions (RULES.md, ADR-004). Steps 1–3 of the evaluation sequence:
 * authenticate → resolve internal user → resolve active memberships.
 */
export interface AuthContext {
  /** Internal Nova user id — not the Clerk id. */
  userId: string;
  email: string;
  displayName: string;
  /** ACTIVE memberships only; deactivated memberships grant nothing. */
  memberships: MembershipView[];
}

/**
 * Resolve the current requester's context, or null when unauthenticated
 * or not yet provisioned. Cached per request.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user) return null;

  const memberships = await listActiveMembershipsForUser(user.id);
  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    memberships,
  };
});

/** Step 1–3, throwing: unauthenticated (or unprovisioned) -> AuthenticationError. */
export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) {
    throw new AuthenticationError();
  }
  return ctx;
}
