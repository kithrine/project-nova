import { prisma } from "@/server/database/prisma";

/**
 * Clerk user provisioning (Story 1.2). A verified webhook maps a Clerk
 * identity onto an internal Nova User record. Idempotent by design:
 * replayed events find the existing row and never create duplicates.
 * Authentication only — memberships/roles are never derived from Clerk
 * (ADR-004).
 */

export interface ClerkUserData {
  clerkUserId: string;
  email: string;
  displayName: string;
}

/** Minimal structural shape of Clerk's user.* webhook payloads. */
export interface ClerkUserPayload {
  id: string;
  email_addresses: { id: string; email_address: string }[];
  primary_email_address_id: string | null;
  first_name: string | null;
  last_name: string | null;
}

/** Pure mapper from a Clerk user payload — unit-testable, no I/O. */
export function mapClerkUserPayload(payload: ClerkUserPayload): ClerkUserData | null {
  const primary =
    payload.email_addresses.find((e) => e.id === payload.primary_email_address_id) ??
    payload.email_addresses[0];
  if (!primary) return null;

  const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ").trim();
  return {
    clerkUserId: payload.id,
    email: primary.email_address.toLowerCase(),
    // Fall back to the email local part so displayName is never empty.
    displayName: name || primary.email_address.split("@")[0],
  };
}

/**
 * Create or update the internal User for a Clerk identity.
 * Order of precedence:
 *   1. Existing row for this clerkUserId -> keep in sync (idempotent replay).
 *   2. Existing row for this email without a Clerk identity -> link it
 *      (pre-provisioned users get connected on first sign-in).
 *   3. Otherwise -> create.
 */
export async function provisionClerkUser(
  data: ClerkUserData,
): Promise<{ userId: string; created: boolean }> {
  const byClerkId = await prisma.user.findUnique({
    where: { clerkUserId: data.clerkUserId },
  });
  if (byClerkId) {
    await prisma.user.update({
      where: { id: byClerkId.id },
      data: { email: data.email, displayName: data.displayName },
    });
    return { userId: byClerkId.id, created: false };
  }

  const byEmail = await prisma.user.findUnique({ where: { email: data.email } });
  if (byEmail) {
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { clerkUserId: data.clerkUserId, displayName: data.displayName },
    });
    return { userId: byEmail.id, created: false };
  }

  const created = await prisma.user.create({
    data: {
      clerkUserId: data.clerkUserId,
      email: data.email,
      displayName: data.displayName,
    },
  });
  return { userId: created.id, created: true };
}
