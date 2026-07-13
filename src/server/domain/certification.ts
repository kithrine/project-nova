import { ActiveStatus } from "@/generated/prisma/client";

/**
 * Certification expiry rules (Story 3.5; ADR-017). Expiry is COMPUTED from
 * expiresOn — never stored — so it cannot go stale: a certification that
 * expires overnight becomes an outstanding item at the next readiness
 * evaluation (3.6) with no write anywhere. A certification is valid THROUGH
 * its expiry date, inclusive, compared at the UTC date level.
 */

export type CertificationExpiryState = "NO_EXPIRY" | "ACTIVE" | "EXPIRED";

export const CERTIFICATION_EXPIRY_LABELS: Record<CertificationExpiryState, string> = {
  NO_EXPIRY: "No expiration",
  ACTIVE: "Active",
  EXPIRED: "Expired",
};

export function certificationExpiryState(
  expiresOn: Date | null,
  now: Date = new Date(),
): CertificationExpiryState {
  if (!expiresOn) return "NO_EXPIRY";
  const validThrough = Date.UTC(
    expiresOn.getUTCFullYear(),
    expiresOn.getUTCMonth(),
    expiresOn.getUTCDate() + 1,
  );
  return now.getTime() >= validThrough ? "EXPIRED" : "ACTIVE";
}

/**
 * Whether a certification currently satisfies a requirement (3.6): the
 * record must be ACTIVE (not archived/revoked) and not expired.
 */
export function certificationSatisfies(
  certification: { status: ActiveStatus; expiresOn: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    certification.status === ActiveStatus.ACTIVE &&
    certificationExpiryState(certification.expiresOn, now) !== "EXPIRED"
  );
}
