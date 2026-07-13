import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Incidents against Neon (Story 5.11): fixed-list reporting with an
 * INC- number, the Serious/Emergency urgent surface, shelter follow-up
 * without classification control, the Nova review-and-closure machine,
 * and the restricted-narrative tier — delivered only to
 * incident.viewRestricted with every delivery audited, structurally
 * absent everywhere else.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("pla511");

describe.skipIf(!hasDatabase)("placement incidents (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/placement-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let coordinatorId: string;
  let rrsId: string;
  let supervisorId: string;
  let otherSupervisorId: string;
  let participantUserId: string;
  let activePlacementId: string;
  let draftPlacementId: string;
  let seriousIncidentId: string;

  const DESCRIPTION = `Synthetic incident ${runId} — gate latch failed during transfer.`;
  const RESTRICTED = `Synthetic restricted narrative ${runId} — names withheld.`;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  function goodInput(overrides: Record<string, unknown> = {}) {
    return {
      category: enums.IncidentCategory.SAFETY,
      severity: enums.IncidentSeverity.SERIOUS,
      occurredOn: new Date("2026-08-20T00:00:00.000Z"),
      description: DESCRIPTION,
      restrictedDetail: RESTRICTED,
      ...overrides,
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

    const mkUser = async (slug: string, orgId: string, role: keyof typeof enums.Role) =>
      (
        await prisma.user.create({
          data: {
            email: `${runId}-${slug}@synthetic.example`,
            displayName: testScopedName(runId, slug),
            isSynthetic: true,
            memberships: {
              create: { organizationId: orgId, role: enums.Role[role] },
            },
          },
        })
      ).id;

    coordinatorId = await mkUser("pc", nova.id, "PROGRAM_COORDINATOR");
    rrsId = await mkUser("rrs", nova.id, "RESTRICTED_REVIEW_SPECIALIST");
    supervisorId = await mkUser("sup", host.id, "SHELTER_SUPERVISOR");
    otherSupervisorId = await mkUser("sup2", otherOrg.id, "SHELTER_SUPERVISOR");

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
    });

    async function chain(slug: string, status: "ACTIVE" | "DRAFT") {
      const user = await prisma.user.create({
        data: {
          email: `${runId}-${slug}@synthetic.example`,
          displayName: testScopedName(runId, slug),
          isSynthetic: true,
          person: {
            create: {
              legalFirstName: slug,
              legalLastName: testScopedName(runId, "Subject"),
              dateOfBirth: new Date("1994-04-04T00:00:00Z"),
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

    const active = await chain("incact", "ACTIVE");
    activePlacementId = active.placementId;
    participantUserId = active.userId;
    draftPlacementId = (await chain("incdrf", "DRAFT")).placementId;
  }, 60_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    const byParticipantUser = {
      placement: { participant: { person: { user: { email: emails } } } },
    };
    await prisma.incidentFollowUp.deleteMany({
      where: { incident: byParticipantUser },
    });
    await prisma.incident.deleteMany({ where: byParticipantUser });
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

  it("saves a categorized, numbered report and withholds the restricted narrative from staff views (AC1/AC5)", { timeout: 30_000 }, async () => {
    const supervisor = await contextFor(supervisorId);
    await service.submitIncident(supervisor, activePlacementId, goodInput());

    const shelterView = await service.getPlacementWorkspace(
      supervisor,
      activePlacementId,
    );
    expect(shelterView.incidents).toBeDefined();
    const entry = shelterView.incidents!.entries[0];
    seriousIncidentId = entry.id;
    expect(entry.incidentNumber).toMatch(/^INC-\d{4}-[A-Z0-9]{6}$/);
    expect(entry.categoryLabel).toBe("Safety");
    expect(entry.severityLabel).toBe("Serious");
    expect(entry.statusLabel).toBe("Open");
    expect(entry.description).toBe(DESCRIPTION);
    // The reporter's own org staff never receive the restricted tier.
    expect(JSON.stringify(shelterView)).not.toContain(RESTRICTED.slice(0, 30));

    // The coordinator reviews the operational record — restricted
    // narrative structurally absent for them too.
    const coordinator = await contextFor(coordinatorId);
    const novaView = await service.getPlacementWorkspace(coordinator, activePlacementId);
    expect(novaView.incidents!.entries[0].description).toBe(DESCRIPTION);
    expect(JSON.stringify(novaView)).not.toContain(RESTRICTED.slice(0, 30));

    // And the participant sees no incident content at all.
    const participant = await contextFor(participantUserId);
    const ownJson = JSON.stringify(await service.getOwnPlacement(participant));
    expect(ownJson).not.toContain(DESCRIPTION.slice(0, 25));
    expect(ownJson).not.toMatch(/incident/i);
  });

  it("delivers the restricted narrative only to incident.viewRestricted, and audits each delivery", async () => {
    const rrs = await contextFor(rrsId);
    const view = await service.getPlacementWorkspace(rrs, activePlacementId);
    expect(view.viewer).toBe("NOVA");
    const entry = view.incidents!.entries.find((row) => row.id === seriousIncidentId);
    expect(entry!.restrictedDetail).toBe(RESTRICTED);

    const audits = await prisma.auditEvent.findMany({
      where: {
        action: "incident.viewRestricted",
        subjectType: "Incident",
        subjectId: seriousIncidentId,
        actorUserId: rrsId,
      },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    // The audit record itself carries no narrative content.
    expect(JSON.stringify(audits)).not.toContain(RESTRICTED.slice(0, 30));
  });

  it("alerts Nova through the urgent surface for Serious/Emergency only (AC2)", async () => {
    const supervisor = await contextFor(supervisorId);
    await service.submitIncident(supervisor, activePlacementId, {
      ...goodInput(),
      severity: enums.IncidentSeverity.MINOR,
      description: `Minor synthetic scrape ${runId}.`,
      restrictedDetail: null,
    });

    const coordinator = await contextFor(coordinatorId);
    const urgent = await service.listUrgentIncidents(coordinator);
    const mine = urgent.filter((row) =>
      [seriousIncidentId].includes(row.incidentId),
    );
    expect(mine).toHaveLength(1);
    expect(mine[0].severityLabel).toBe("Serious");
    // The minor report never reaches the urgent queue.
    expect(
      urgent.find((row) => row.categoryLabel === "Safety" && row.severityLabel === "Minor"),
    ).toBeUndefined();

    await expect(
      service.listUrgentIncidents(await contextFor(supervisorId)),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
  });

  it("lets shelter staff follow up but never reclassify, review, or close (AC3)", async () => {
    const supervisor = await contextFor(supervisorId);
    await service.addIncidentFollowUp(
      supervisor,
      seriousIncidentId,
      "Latch replaced same day; participant unharmed.",
    );

    const view = await service.getPlacementWorkspace(supervisor, activePlacementId);
    const entry = view.incidents!.entries.find((row) => row.id === seriousIncidentId)!;
    expect(entry.followUps).toHaveLength(1);
    expect(entry.followUps[0].body).toContain("Latch replaced");
    // Classification unchanged; no shelter-side review capability.
    expect(entry.severityLabel).toBe("Serious");
    expect(entry.viewerCanReview).toBe(false);

    await expect(
      service.startIncidentReview(supervisor, seriousIncidentId),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
    await expect(
      service.closeIncident(supervisor, seriousIncidentId, "attempt"),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });

    // Cross-organization staff cannot report or follow up at all.
    const outsider = await contextFor(otherSupervisorId);
    await expect(
      service.submitIncident(outsider, activePlacementId, goodInput()),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
    await expect(
      service.addIncidentFollowUp(outsider, seriousIncidentId, "outside"),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
  });

  it("runs review to closure with reviewer, timestamp, and outcome — then read-only history (AC4/AC6)", { timeout: 30_000 }, async () => {
    const coordinator = await contextFor(coordinatorId);

    await service.startIncidentReview(coordinator, seriousIncidentId);
    let incident = await prisma.incident.findUniqueOrThrow({
      where: { id: seriousIncidentId },
    });
    expect(incident.status).toBe(enums.IncidentStatus.UNDER_REVIEW);
    expect(incident.reviewerUserId).toBe(coordinatorId);

    await service.closeIncident(
      coordinator,
      seriousIncidentId,
      "Reviewed with the site; latch replaced and rechecked.",
    );
    incident = await prisma.incident.findUniqueOrThrow({
      where: { id: seriousIncidentId },
    });
    expect(incident.status).toBe(enums.IncidentStatus.CLOSED);
    expect(incident.closedByUserId).toBe(coordinatorId);
    expect(incident.closedAt).not.toBeNull();
    expect(incident.closureOutcome).toContain("latch replaced");

    // Read-only history: no reopening, no further follow-ups.
    await expect(
      service.closeIncident(coordinator, seriousIncidentId, "again"),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
    await expect(
      service.startIncidentReview(coordinator, seriousIncidentId),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
    await expect(
      service.addIncidentFollowUp(coordinator, seriousIncidentId, "late"),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });

    // Off the urgent queue once closed.
    const urgent = await service.listUrgentIncidents(coordinator);
    expect(urgent.find((row) => row.incidentId === seriousIncidentId)).toBeUndefined();
  });

  it("rejects reports before site activity exists (lifecycle rules)", async () => {
    const supervisor = await contextFor(supervisorId);
    await expect(
      service.submitIncident(supervisor, draftPlacementId, goodInput()),
    ).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.stringContaining("onboarding"),
    });
  });
});
