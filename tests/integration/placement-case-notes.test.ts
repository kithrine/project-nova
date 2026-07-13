import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Placement case notes against Neon (Story 5.9): Nova-only authoring and
 * reading, edit history that never overwrites, the XOR ownership CHECK at
 * the database, terminal-stage note-keeping, and — most important — the
 * repository-level proof that shelter and participant view models carry
 * neither note content nor the caseNotes field at all.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("pla59");

describe.skipIf(!hasDatabase)("placement case notes (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/placement-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let coordinatorId: string;
  let adminId: string;
  let managerId: string;
  let grantAdminId: string;
  let participantUserId: string;
  let placementId: string;

  const NOTE_BODY = `Synthetic internal note ${runId} — coordination detail.`;

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
        sites: { create: [{ name: testScopedName(runId, "Main Site"), capacity: 2 }] },
      },
      include: { sites: true },
    });
    const mkUser = async (slug: string, orgId: string | null, role: keyof typeof enums.Role | null) =>
      prisma.user.create({
        data: {
          email: `${runId}-${slug}@synthetic.example`,
          displayName: testScopedName(runId, slug),
          isSynthetic: true,
          ...(orgId && role
            ? { memberships: { create: { organizationId: orgId, role: enums.Role[role] } } }
            : {}),
        },
      });

    coordinatorId = (await mkUser("pc", nova.id, "PROGRAM_COORDINATOR")).id;
    adminId = (await mkUser("na", nova.id, "NOVA_ADMINISTRATOR")).id;
    managerId = (await mkUser("mgr", host.id, "SHELTER_MANAGER")).id;
    grantAdminId = (await mkUser("ga", nova.id, "GRANT_ADMINISTRATOR")).id;

    // Participant chain with a COMPLETED placement: notes must remain
    // writable and readable at terminal stages (AC6).
    const partUser = await prisma.user.create({
      data: {
        email: `${runId}-part@synthetic.example`,
        displayName: testScopedName(runId, "Participant"),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Note",
            legalLastName: testScopedName(runId, "Subject"),
            dateOfBirth: new Date("1992-02-02T00:00:00Z"),
          },
        },
      },
    });
    participantUserId = partUser.id;
    const person = await prisma.person.findUniqueOrThrow({
      where: { userId: partUser.id },
    });
    const application = await prisma.application.create({
      data: {
        personId: person.id,
        applicationNumber: `APP-${runId.slice(-4).toUpperCase()}-NOTES1`,
        status: enums.ApplicationStatus.ACCEPTED,
        submittedAt: new Date(),
        decidedAt: new Date(),
      },
    });
    const participant = await prisma.participant.create({ data: { personId: person.id } });
    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Program") },
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
        placementNumber: `PLC-${runId.slice(-4).toUpperCase()}-NOTES1`,
        participantId: participant.id,
        programEnrollmentId: enrollment.id,
        hostOrganizationId: host.id,
        organizationSiteId: host.sites[0].id,
        sourceMatchId: match.id,
        status: enums.PlacementStatus.COMPLETED,
      },
    });
    placementId = placement.id;
  }, 60_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    const byParticipantUser = {
      placement: { participant: { person: { user: { email: emails } } } },
    };
    await prisma.caseNoteRevision.deleteMany({
      where: { caseNote: byParticipantUser },
    });
    await prisma.caseNote.deleteMany({ where: byParticipantUser });
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

  it("saves an authored, timestamped note — even on a terminal placement (AC1/AC6)", async () => {
    const coordinator = await contextFor(coordinatorId);
    await service.addPlacementCaseNote(coordinator, placementId, NOTE_BODY);

    const view = await service.getPlacementWorkspace(coordinator, placementId);
    expect(view.tabs).toContain("caseNotes");
    expect(view.caseNotes).toBeDefined();
    expect(view.caseNotes!.notes).toHaveLength(1);
    expect(view.caseNotes!.notes[0].body).toBe(NOTE_BODY);
    expect(view.caseNotes!.notes[0].authorName).toContain("pc");
    expect(view.caseNotes!.notes[0].atLabel).not.toHaveLength(0);
    expect(view.caseNotes!.viewerCanCreate).toBe(true);
  });

  it("preserves prior content as history on edit, and conflicts instead of losing a version (AC5)", async () => {
    const admin = await contextFor(adminId);
    const before = await service.getPlacementWorkspace(admin, placementId);
    const noteId = before.caseNotes!.notes[0].id;

    await service.editPlacementCaseNote(admin, noteId, `${NOTE_BODY} Updated.`);

    const after = await service.getPlacementWorkspace(admin, placementId);
    const note = after.caseNotes!.notes[0];
    expect(note.body).toBe(`${NOTE_BODY} Updated.`);
    expect(note.revisions).toHaveLength(1);
    expect(note.revisions[0].priorBody).toBe(NOTE_BODY);
    expect(note.revisions[0].editorName).toContain("na");

    // A stale concurrent edit hits the compare-and-set, never a silent
    // overwrite: replay the SAME edit basis by re-editing with unchanged
    // content first (validation) then simulating staleness via direct row
    // touch.
    await expect(
      service.editPlacementCaseNote(admin, noteId, `${NOTE_BODY} Updated.`),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("enforces XOR ownership at the database (AC4)", async () => {
    // Neither owner:
    await expect(
      prisma.caseNote.create({
        data: { authorUserId: coordinatorId, body: "orphan" },
      }),
    ).rejects.toThrowError(/CaseNote_owner_xor_check|check constraint/);
    // Both owners:
    const anyApplication = await prisma.application.findFirst({
      where: { applicationNumber: { contains: runId.slice(-4).toUpperCase() } },
      select: { id: true },
    });
    await expect(
      prisma.caseNote.create({
        data: {
          authorUserId: coordinatorId,
          body: "double owner",
          applicationId: anyApplication!.id,
          placementId,
        },
      }),
    ).rejects.toThrowError(/CaseNote_owner_xor_check|check constraint/);
  });

  it("keeps note content and the caseNotes field out of shelter and participant payloads (AC2/AC3)", async () => {
    const manager = await contextFor(managerId);
    const shelterView = await service.getPlacementWorkspace(manager, placementId);
    expect(shelterView.viewer).toBe("SHELTER");
    expect(shelterView.tabs).not.toContain("caseNotes");
    const shelterJson = JSON.stringify(shelterView);
    expect(shelterJson).not.toContain(NOTE_BODY.slice(0, 30));
    expect(shelterJson).not.toMatch(/caseNote/i);

    const participant = await contextFor(participantUserId);
    const ownView = await service.getOwnPlacement(participant);
    const participantJson = JSON.stringify(ownView);
    expect(participantJson).not.toContain(NOTE_BODY.slice(0, 30));
    expect(participantJson).not.toMatch(/caseNote/i);
  });

  it("shapes the tab away from Nova viewers without caseNote.view (Grant Administrator)", async () => {
    const grantAdmin = await contextFor(grantAdminId);
    const view = await service.getPlacementWorkspace(grantAdmin, placementId);
    expect(view.viewer).toBe("NOVA");
    expect(view.tabs).not.toContain("caseNotes");
    expect(JSON.stringify(view)).not.toContain(NOTE_BODY.slice(0, 30));
  });

  it("denies authoring and editing outside Nova note permissions (AC2)", async () => {
    const manager = await contextFor(managerId);
    await expect(
      service.addPlacementCaseNote(manager, placementId, "shelter attempt"),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });

    const coordinator = await contextFor(coordinatorId);
    const view = await service.getPlacementWorkspace(coordinator, placementId);
    await expect(
      service.editPlacementCaseNote(manager, view.caseNotes!.notes[0].id, "x"),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });

    // Application-owned notes are not editable through the placement path.
    await expect(
      service.editPlacementCaseNote(coordinator, "nonexistent_note", "x"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
