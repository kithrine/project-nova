import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Workplace evaluations against Neon (Story 5.10): shelter submission on
 * an Active placement, Nova-wide reading, org-scope denial, the
 * Active/Paused lifecycle window, immutability-by-accumulation, and the
 * default-closed participant posture (open-questions.md #5).
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("pla510");

describe.skipIf(!hasDatabase)("placement evaluations (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/placement-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let coordinatorId: string;
  let grantAdminId: string;
  let supervisorId: string;
  let otherSupervisorId: string;
  let participantUserId: string;
  let activePlacementId: string;
  let onboardingPlacementId: string;

  const STRENGTHS = `Synthetic strengths ${runId} — careful with the animals.`;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  function goodInput() {
    return {
      evaluationDate: new Date("2026-08-15T00:00:00.000Z"),
      ratings: {
        reliability: enums.EvaluationRating.MEETS_EXPECTATIONS,
        taskQuality: enums.EvaluationRating.EXCEEDS_EXPECTATIONS,
        teamwork: enums.EvaluationRating.DEVELOPING,
      },
      strengths: STRENGTHS,
      growthAreas: null,
    };
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    service = await import("@/server/services/placement-service");
    memberships = await import("@/server/repositories/membership-repository");
    enums = await import("@/generated/prisma/enums");

    const nova = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Nova Org"),
        kind: enums.OrganizationKind.NOVA,
        isSynthetic: true,
      },
    });
    const host = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Host Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
        sites: { create: [{ name: testScopedName(runId, "Main Site"), capacity: 3 }] },
      },
      include: { sites: true },
    });
    const otherOrg = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Other Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
      },
    });

    coordinatorId = (
      await prisma.user.create({
        data: {
          email: `${runId}-pc@synthetic.example`,
          displayName: testScopedName(runId, "Coordinator"),
          isSynthetic: true,
          memberships: {
            create: { organizationId: nova.id, role: enums.Role.PROGRAM_COORDINATOR },
          },
        },
      })
    ).id;
    grantAdminId = (
      await prisma.user.create({
        data: {
          email: `${runId}-ga@synthetic.example`,
          displayName: testScopedName(runId, "Grant Admin"),
          isSynthetic: true,
          memberships: {
            create: { organizationId: nova.id, role: enums.Role.GRANT_ADMINISTRATOR },
          },
        },
      })
    ).id;
    supervisorId = (
      await prisma.user.create({
        data: {
          email: `${runId}-sup@synthetic.example`,
          displayName: testScopedName(runId, "Supervisor"),
          isSynthetic: true,
          memberships: {
            create: { organizationId: host.id, role: enums.Role.SHELTER_SUPERVISOR },
          },
        },
      })
    ).id;
    otherSupervisorId = (
      await prisma.user.create({
        data: {
          email: `${runId}-sup2@synthetic.example`,
          displayName: testScopedName(runId, "Other Supervisor"),
          isSynthetic: true,
          memberships: {
            create: { organizationId: otherOrg.id, role: enums.Role.SHELTER_SUPERVISOR },
          },
        },
      })
    ).id;

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });

    async function chain(slug: string, status: "ACTIVE" | "ONBOARDING") {
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${slug}@synthetic.example`,
          displayName: testScopedName(runId, slug),
          isSynthetic: true,
          person: {
            create: {
              legalFirstName: slug,
              legalLastName: testScopedName(runId, "Subject"),
              dateOfBirth: new Date("1993-03-03T00:00:00Z"),
            },
          },
        },
      });
      const person = await prisma.person.findUniqueOrThrow({
        where: { userId: user.id },
      });
      const application = await prisma.application.create({
        data: {
          personId: person.id,
          applicationNumber: `APP-${runId.slice(-4).toUpperCase()}-${slug.toUpperCase().slice(0, 6)}`,
          status: enums.ApplicationStatus.ACCEPTED,
          submittedAt: new Date(),
          decidedAt: new Date(),
        },
      });
      const participant = await prisma.participant.create({
        data: { personId: person.id },
      });
      const enrollment = await prisma.programEnrollment.create({
        data: {
          participantId: participant.id,
          programId: program.id,
          applicationId: application.id,
          status: enums.EnrollmentStatus.READY_FOR_MATCHING,
        },
      });
      const match = await prisma.placementMatch.create({
        data: {
          participantId: participant.id,
          programEnrollmentId: enrollment.id,
          hostOrganizationId: host.id,
          organizationSiteId: host.sites[0].id,
          status: enums.MatchStatus.APPROVED,
          participantDecision: enums.ParticipantMatchDecision.ACCEPTED,
          shelterDecision: enums.ShelterMatchDecision.APPROVED,
        },
      });
      const placement = await prisma.placement.create({
        data: {
          placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-${slug.toUpperCase().slice(0, 6)}`,
          participantId: participant.id,
          programEnrollmentId: enrollment.id,
          hostOrganizationId: host.id,
          organizationSiteId: host.sites[0].id,
          sourceMatchId: match.id,
          status: enums.PlacementStatus[status],
        },
      });
      return { userId: user.id, placementId: placement.id };
    }

    const active = await chain("evalact", "ACTIVE");
    activePlacementId = active.placementId;
    participantUserId = active.userId;
    onboardingPlacementId = (await chain("evalonb", "ONBOARDING")).placementId;
  }, 60_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    const byParticipantUser = {
      placement: { participant: { person: { user: { email: emails } } } },
    };
    await prisma.evaluation.deleteMany({ where: byParticipantUser });
    await prisma.placementEvent.deleteMany({ where: byParticipantUser });
    await prisma.placement.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.placementMatch.deleteMany({
      where: { participant: { person: { user: { email: emails } } } },
    });
    await prisma.programEnrollment.deleteMany({
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
    await prisma.program.deleteMany({ where: { code: { contains: runId } } });
    await prisma.organizationSite.deleteMany({
      where: { organization: { name: { contains: runId } } },
    });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  }, 60_000);

  it("saves a structured, authored evaluation on an Active placement (AC1) readable by Nova (AC2)", async () => {
    const supervisor = await contextFor(supervisorId);
    await service.submitEvaluation(supervisor, activePlacementId, goodInput());

    // The shelter's own view lists it and offers the form.
    const shelterView = await service.getPlacementWorkspace(
      supervisor,
      activePlacementId,
    );
    expect(shelterView.evaluations).toBeDefined();
    expect(shelterView.evaluations!.viewerCanSubmit).toBe(true);
    expect(shelterView.evaluations!.entries).toHaveLength(1);
    const entry = shelterView.evaluations!.entries[0];
    expect(entry.authorName).toContain("Supervisor");
    expect(entry.strengths).toBe(STRENGTHS);
    expect(entry.ratings.map((rating) => rating.ratingLabel)).toEqual([
      "Meets expectations",
      "Exceeds expectations",
      "Developing",
    ]);
    expect(entry.evaluationDateLabel).toBe("August 15, 2026");

    // The coordinator reads the full evaluation, but never submits.
    const coordinator = await contextFor(coordinatorId);
    const novaView = await service.getPlacementWorkspace(coordinator, activePlacementId);
    expect(novaView.tabs).toContain("evaluations");
    expect(novaView.evaluations!.entries[0].strengths).toBe(STRENGTHS);
    expect(novaView.evaluations!.viewerCanSubmit).toBe(false);
    await expect(
      service.submitEvaluation(coordinator, activePlacementId, goodInput()),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
  });

  it("accumulates submissions newest-first — corrections are new records, never edits (AC4)", async () => {
    const supervisor = await contextFor(supervisorId);
    await service.submitEvaluation(supervisor, activePlacementId, {
      ...goodInput(),
      strengths: `${STRENGTHS} (revised)`,
    });

    const view = await service.getPlacementWorkspace(supervisor, activePlacementId);
    expect(view.evaluations!.entries).toHaveLength(2);
    expect(view.evaluations!.entries[0].strengths).toBe(`${STRENGTHS} (revised)`);
    expect(view.evaluations!.entries[1].strengths).toBe(STRENGTHS);
  });

  it("denies a supervisor from another organization by resource scope (AC3)", async () => {
    const outsider = await contextFor(otherSupervisorId);
    await expect(
      service.submitEvaluation(outsider, activePlacementId, goodInput()),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
    await expect(
      service.getPlacementWorkspace(outsider, activePlacementId),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
  });

  it("rejects submissions outside the Active/Paused window (AC5)", async () => {
    const supervisor = await contextFor(supervisorId);
    await expect(
      service.submitEvaluation(supervisor, onboardingPlacementId, goodInput()),
    ).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.stringContaining("active or paused"),
    });
  });

  it("keeps evaluation content out of the participant's view — default closed (AC6)", async () => {
    const participant = await contextFor(participantUserId);
    const ownView = await service.getOwnPlacement(participant);
    expect(ownView).not.toBeNull();
    const json = JSON.stringify(ownView);
    expect(json).not.toContain(STRENGTHS.slice(0, 25));
    expect(json).not.toMatch(/evaluation/i);
  });

  it("shapes the tab away from Nova viewers without evaluation.view (Grant Administrator)", async () => {
    const grantAdmin = await contextFor(grantAdminId);
    const view = await service.getPlacementWorkspace(grantAdmin, activePlacementId);
    expect(view.viewer).toBe("NOVA");
    expect(view.tabs).not.toContain("evaluations");
    expect(JSON.stringify(view)).not.toContain(STRENGTHS.slice(0, 25));
  });
});
