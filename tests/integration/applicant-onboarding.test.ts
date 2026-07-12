import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Applicant onboarding against Neon (Story 2.2): idempotent create-or-reuse
 * per User, ownership scoping, and the applicant/participant distinction
 * (no Role, no Membership). Shared-nonprod isolation per ADR-006.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("onb22");

describe.skipIf(!hasDatabase)("applicant onboarding (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/applicant-onboarding");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let experience: typeof import("@/server/auth/experience");

  let userAId: string;
  let userBId: string;

  const input = {
    legalFirstName: "Casey",
    legalLastName: testScopedName(runId, "Applicant"),
    dateOfBirth: "1992-08-03",
    phone: "555-010-2233",
    mailingAddressLine1: "44 Cedar Court",
    mailingAddressLine2: undefined,
    city: "Springfield",
    region: "WA",
    postalCode: "98102",
  };

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    service = await import("@/server/services/applicant-onboarding");
    memberships = await import("@/server/repositories/membership-repository");
    experience = await import("@/server/auth/experience");

    const [a, b] = await Promise.all([
      prisma.user.create({
        data: {
          email: `${runId}-a@synthetic.example`,
          displayName: testScopedName(runId, "Applicant A"),
          isSynthetic: true,
        },
      }),
      prisma.user.create({
        data: {
          email: `${runId}-b@synthetic.example`,
          displayName: testScopedName(runId, "Applicant B"),
          isSynthetic: true,
        },
      }),
    ]);
    userAId = a.id;
    userBId = b.id;
  });

  afterAll(async () => {
    await prisma.applicantProfile.deleteMany({
      where: { person: { user: { email: { startsWith: `${runId}-` } } } },
    });
    await prisma.person.deleteMany({
      where: { user: { email: { startsWith: `${runId}-` } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: `${runId}-` } } });
    await prisma.$disconnect();
  });

  it("creates Person + ApplicantProfile atomically for a first-time applicant", async () => {
    const ctx = await contextFor(userAId);
    const person = await service.completeApplicantOnboarding(ctx, input);

    expect(person.legalFirstName).toBe("Casey");
    expect(person.dateOfBirth).toBe("1992-08-03");
    expect(person.hasProfile).toBe(true);

    const row = await prisma.person.findUnique({
      where: { userId: userAId },
      include: { applicantProfile: true },
    });
    expect(row?.applicantProfile?.postalCode).toBe("98102");
  });

  it("reuses the existing record on repeat completion — no duplicates", async () => {
    const ctx = await contextFor(userAId);
    const again = await service.completeApplicantOnboarding(ctx, {
      ...input,
      legalFirstName: "Different",
    });

    // Same record returned; the original data stands (reuse, not overwrite).
    const first = await service.getOwnPerson(ctx);
    expect(again.id).toBe(first?.id);
    expect(again.legalFirstName).toBe("Casey");

    const count = await prisma.person.count({ where: { userId: userAId } });
    expect(count).toBe(1);
  });

  it("scopes by ownership: another user's context never sees A's record", async () => {
    const ctxB = await contextFor(userBId);
    const own = await service.getOwnPerson(ctxB);
    expect(own).toBeNull(); // B has no Person — and A's is invisible to B by construction
  });

  it("confers no Role and no Membership — the applicant is not a Participant", async () => {
    const ctx = await contextFor(userAId);
    expect(ctx.memberships).toHaveLength(0);
    expect(experience.canAccessExperience(ctx, "operations")).toBe(false);
    expect(experience.canAccessExperience(ctx, "shelter")).toBe(false);
    expect(experience.routeForContext(ctx)).toBe("/participant");

    const membershipCount = await prisma.membership.count({ where: { userId: userAId } });
    expect(membershipCount).toBe(0);
  });
});

describe.skipIf(hasDatabase)("applicant onboarding (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
