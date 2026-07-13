import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Certifications against Neon (Story 3.5): coordinator record/update with
 * prior-values audit history, the Document XOR constraint (exactly one
 * owning context, enforced by Postgres), and participant isolation.
 * Shared-nonprod isolation per ADR-006.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("crt35");

describe.skipIf(!hasDatabase)("certifications (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/certification-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");
  let errors: typeof import("@/server/errors/app-error");

  let coordinatorId: string;
  let ownerUserId: string;
  let strangerUserId: string;
  let ownerParticipantId: string;
  let ownerApplicationId: string;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  async function createParticipantUser(tag: string) {
    const user = await prisma.user.create({
      data: {
        email: `${runId}-${tag}@synthetic.example`,
        displayName: testScopedName(runId, tag),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Cert",
            legalLastName: testScopedName(runId, tag),
            dateOfBirth: new Date("1990-03-03T00:00:00Z"),
          },
        },
      },
    });
    const person = await prisma.person.findUniqueOrThrow({ where: { userId: user.id } });
    const application = await prisma.application.create({
      data: {
        personId: person.id,
        applicationNumber: `APP-${runId.slice(-4).toUpperCase()}-${tag.toUpperCase()}`,
        status: enums.ApplicationStatus.ACCEPTED,
        submittedAt: new Date(),
        decidedAt: new Date(),
      },
    });
    const participant = await prisma.participant.create({ data: { personId: person.id } });
    return { userId: user.id, participantId: participant.id, applicationId: application.id };
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    service = await import("@/server/services/certification-service");
    memberships = await import("@/server/repositories/membership-repository");
    enums = await import("@/generated/prisma/enums");
    errors = await import("@/server/errors/app-error");

    const nova = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Nova Org"),
        kind: enums.OrganizationKind.NOVA,
        isSynthetic: true,
      },
    });
    const coordinator = await prisma.user.create({
      data: {
        email: `${runId}-pc@synthetic.example`,
        displayName: testScopedName(runId, "Coordinator"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: nova.id, role: enums.Role.PROGRAM_COORDINATOR },
        },
      },
    });
    coordinatorId = coordinator.id;

    const owner = await createParticipantUser("owner");
    ownerUserId = owner.userId;
    ownerParticipantId = owner.participantId;
    ownerApplicationId = owner.applicationId;
    const stranger = await createParticipantUser("stranger");
    strangerUserId = stranger.userId;
  }, 30_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.auditEvent.deleteMany({ where: { actorUserId: coordinatorId } });
    await prisma.document.deleteMany({
      where: { certification: { participant: { person: { user: { email: emails } } } } },
    });
    await prisma.certification.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.participant.deleteMany({
      where: { person: { user: { email: emails } } },
    });
    await prisma.application.deleteMany({
      where: { person: { user: { email: emails } } },
    });
    await prisma.person.deleteMany({ where: { user: { email: emails } } });
    await prisma.membership.deleteMany({ where: { user: { email: emails } } });
    await prisma.user.deleteMany({ where: { email: emails } });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  }, 30_000);

  it("records and corrects a certification, preserving prior values in the audit trail (AC1/AC5)", async () => {
    const ctx = await contextFor(coordinatorId);
    const created = await service.recordCertification(ctx, ownerParticipantId, {
      name: testScopedName(runId, "Pet CPR"),
      issuer: "Animal Care Academy",
      issuedOn: new Date("2026-01-05T00:00:00Z"),
      expiresOn: new Date("2028-01-05T00:00:00Z"),
      requiredForMatching: true,
    });

    await prisma.auditEvent.findFirstOrThrow({
      where: { action: "certification.record", subjectId: created.id },
    });

    // Correction: the prior issue date must survive in the audit trail.
    await service.updateCertification(ctx, created.id, {
      name: testScopedName(runId, "Pet CPR"),
      issuer: "Animal Care Academy",
      issuedOn: new Date("2026-01-06T00:00:00Z"),
      expiresOn: new Date("2028-01-05T00:00:00Z"),
      requiredForMatching: true,
      status: enums.ActiveStatus.ACTIVE,
    });

    const row = await prisma.certification.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.issuedOn.toISOString().slice(0, 10)).toBe("2026-01-06");

    const history = await prisma.auditEvent.findFirstOrThrow({
      where: { action: "certification.update", subjectId: created.id },
    });
    expect(history.detail).toContain("issuedOn=2026-01-05");
  });

  it("enforces exactly one owning context per document at the database layer (AC3)", async () => {
    const certification = await prisma.certification.findFirstOrThrow({
      where: { participantId: ownerParticipantId },
    });
    const base = {
      documentType: enums.DocumentType.CERTIFICATION,
      fileName: "cert.pdf",
      contentType: "application/pdf",
      sizeBytes: 100,
      storageUrl: "https://example.invalid/cert",
      uploadedByUserId: coordinatorId,
    };

    // Both owners set -> rejected by the CHECK constraint.
    await expect(
      prisma.document.create({
        data: {
          ...base,
          storagePathname: `${runId}-both-owners`,
          applicationId: ownerApplicationId,
          certificationId: certification.id,
        },
      }),
    ).rejects.toThrow();

    // No owner at all -> rejected too.
    await expect(
      prisma.document.create({
        data: { ...base, storagePathname: `${runId}-no-owner` },
      }),
    ).rejects.toThrow();

    // Exactly one owner -> accepted.
    const valid = await prisma.document.create({
      data: {
        ...base,
        storagePathname: `${runId}-cert-owner`,
        certificationId: certification.id,
      },
    });
    expect(valid.applicationId).toBeNull();
  });

  it("returns only the requester's own certifications, with no coordinator detail (AC4)", async () => {
    const ownerCtx = await contextFor(ownerUserId);
    const strangerCtx = await contextFor(strangerUserId);

    const own = await service.getOwnCertifications(ownerCtx);
    expect(own.length).toBeGreaterThan(0);
    expect(own[0].documentId).toBeTruthy(); // the attachment from the prior test
    expect(JSON.stringify(own)).not.toContain("requiredForMatching");

    expect(await service.getOwnCertifications(strangerCtx)).toEqual([]);
  });

  it("hides archived records from the participant but keeps them in the ops list", async () => {
    const ctx = await contextFor(coordinatorId);
    const archived = await service.recordCertification(ctx, ownerParticipantId, {
      name: testScopedName(runId, "Old Credential"),
      issuer: "Elsewhere",
      issuedOn: new Date("2020-01-01T00:00:00Z"),
      requiredForMatching: false,
    });
    await service.updateCertification(ctx, archived.id, {
      name: testScopedName(runId, "Old Credential"),
      issuer: "Elsewhere",
      issuedOn: new Date("2020-01-01T00:00:00Z"),
      requiredForMatching: false,
      status: enums.ActiveStatus.INACTIVE,
    });

    const ownerCtx = await contextFor(ownerUserId);
    const own = await service.getOwnCertifications(ownerCtx);
    expect(own.find((c) => c.id === archived.id)).toBeUndefined();

    const opsList = await service.listCertificationsForParticipant(ctx, ownerParticipantId);
    expect(opsList.find((c) => c.id === archived.id)?.status).toBe(
      enums.ActiveStatus.INACTIVE,
    );
  });

  it("denies certification writes without the permission", async () => {
    const ownerCtx = await contextFor(ownerUserId);
    await expect(
      service.recordCertification(ownerCtx, ownerParticipantId, {
        name: "Self-recorded",
        issuer: "Me",
        issuedOn: new Date("2026-01-01T00:00:00Z"),
        requiredForMatching: false,
      }),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
  });
});

describe.skipIf(hasDatabase)("certifications (unconfigured)", () => {
  it("is skipped because DATABASE_URL is not set", () => {
    expect(hasDatabase).toBe(false);
  });
});
