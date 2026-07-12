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

/**
 * Like getAuthContext, but provisions the internal User on first sign-in
 * when it does not exist yet (Story 2.2). Uses the same idempotent service
 * as the Clerk webhook (1.2) — this is the self-service fallback for
 * environments the webhook cannot reach (local dev, previews); in
 * production both paths coexist safely because provisioning is idempotent.
 */
export async function getOrProvisionAuthContext(): Promise<AuthContext | null> {
  const existing = await getAuthContext();
  if (existing) return existing;

  const { currentUser } = await import("@clerk/nextjs/server");
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const { mapClerkUserPayload, provisionClerkUser } = await import(
    "@/server/services/user-provisioning"
  );
  const mapped = mapClerkUserPayload({
    id: clerkUser.id,
    email_addresses: clerkUser.emailAddresses.map((e) => ({
      id: e.id,
      email_address: e.emailAddress,
    })),
    primary_email_address_id: clerkUser.primaryEmailAddressId,
    first_name: clerkUser.firstName,
    last_name: clerkUser.lastName,
  });
  if (!mapped) return null;

  await provisionClerkUser(mapped);

  // Re-resolve through the standard path (bypasses this request's cache miss).
  const user = await prisma.user.findUnique({ where: { clerkUserId: clerkUser.id } });
  if (!user) return null;
  const memberships = await listActiveMembershipsForUser(user.id);
  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    memberships,
  };
}
