import { describe, expect, it } from "vitest";

import { ActiveStatus } from "@/generated/prisma/client";
import {
  certificationExpiryState,
  certificationSatisfies,
} from "./certification";

describe("certificationExpiryState (Story 3.5)", () => {
  const noon = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

  it("treats no expiration date as never expiring", () => {
    expect(certificationExpiryState(null, noon("2030-01-01"))).toBe("NO_EXPIRY");
  });

  it("is valid THROUGH the expiry date, inclusive", () => {
    const expiresOn = new Date("2026-07-12T00:00:00.000Z");
    expect(certificationExpiryState(expiresOn, noon("2026-07-11"))).toBe("ACTIVE");
    expect(certificationExpiryState(expiresOn, noon("2026-07-12"))).toBe("ACTIVE");
    expect(certificationExpiryState(expiresOn, noon("2026-07-13"))).toBe("EXPIRED");
  });

  it("flips exactly at the UTC day boundary", () => {
    const expiresOn = new Date("2026-07-12T00:00:00.000Z");
    expect(
      certificationExpiryState(expiresOn, new Date("2026-07-12T23:59:59.999Z")),
    ).toBe("ACTIVE");
    expect(
      certificationExpiryState(expiresOn, new Date("2026-07-13T00:00:00.000Z")),
    ).toBe("EXPIRED");
  });
});

describe("certificationSatisfies (feeds 3.6 readiness)", () => {
  const now = new Date("2026-07-12T12:00:00.000Z");

  it("satisfies when ACTIVE and unexpired (or never expiring)", () => {
    expect(
      certificationSatisfies({ status: ActiveStatus.ACTIVE, expiresOn: null }, now),
    ).toBe(true);
    expect(
      certificationSatisfies(
        { status: ActiveStatus.ACTIVE, expiresOn: new Date("2027-01-01T00:00:00Z") },
        now,
      ),
    ).toBe(true);
  });

  it("never satisfies when expired — an expired required credential is outstanding (AC2)", () => {
    expect(
      certificationSatisfies(
        { status: ActiveStatus.ACTIVE, expiresOn: new Date("2026-01-01T00:00:00Z") },
        now,
      ),
    ).toBe(false);
  });

  it("never satisfies when the record is archived, regardless of dates", () => {
    expect(
      certificationSatisfies({ status: ActiveStatus.INACTIVE, expiresOn: null }, now),
    ).toBe(false);
  });
});
