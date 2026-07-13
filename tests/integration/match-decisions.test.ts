import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Participant decisions against Neon (Story 4.5): the ownership and
 * coordinator-assisted recording paths, the unilateral-decline veto, the
 * Proposed-only and one-way gates, expiry-before-late-decision, and the
 * note's visibility boundary (Operations yes; shelter and audit detail
 * never).
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const runId = createTestRunId("mdec45");

const DECLINE_NOTE = "Prefers a different schedule — told us by phone";

describe.skipIf(!hasDatabase)("participant match decisions (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/matching-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");

  let coordinatorId: string;
  let shelterManagerId: string;
  let shelterSupervisorId: string;
  let otherOrgManagerId: string;
  let hostOrgId: string;
  let siteId: string;
  let programId: string;

  interface Fixture {
    userId: string;
    participantId: string;
    enrollmentId: string;
    matchId: string;
  }
  let accepting: Fixture;
  let declining: Fixture;
  let assisted: Fixture;
  let drafted: Fixture;
  let stale: Fixture;
  let shelterApproving: Fixture;
  let shelterChanging: Fixture;
  let shelterDeclining: Fixture;
  let shelterWithdrawing: Fixture;

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  async function createFixture(
    tag: string,
    match: { status: "PROPOSED" | "DRAFT"; windowEndsAt?: Date },
  ): Promise<Fixture> {
    const user = await prisma.user.create({
      data: {
        email: `${runId}-${tag}@synthetic.example`,
        displayName: testScopedName(runId, tag),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Decide",
            legalLastName: testScopedName(runId, tag),
            dateOfBirth: new Date("1991-01-01T00:00:00Z"),
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
        availabilityNotes: "Weekday mornings",
      },
    });
    const participant = await prisma.participant.create({ data: { personId: person.id } });
    const enrollment = await prisma.programEnrollment.create({
      data: {
        participantId: participant.id,
        programId,
        applicationId: application.id,
        status: enums.EnrollmentStatus.READY_FOR_MATCHING,
      },
    });

    const proposed = match.status === "PROPOSED";
    const created = await prisma.placementMatch.create({
      data: {
        participantId: participant.id,
        programEnrollmentId: enrollment.id,
        hostOrganizationId: hostOrgId,
        organizationSiteId: siteId,
        status: enums.MatchStatus[match.status],
        proposedSupervisorId: shelterManagerId,
        proposedSchedule: "Mon/Wed mornings",
        proposedStartDate: new Date("2026-08-03T00:00:00Z"),
        proposedEndDate: new Date("2026-12-04T00:00:00Z"),
        ...(proposed
          ? {
              proposedAt: new Date(),
              decisionWindowEndsAt:
                match.windowEndsAt ?? new Date(Date.now() + 14 * 86_400_000),
            }
          : {}),
      },
    });
    return {
      userId: user.id,
      participantId: participant.id,
      enrollmentId: enrollment.id,
      matchId: created.id,
    };
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    service = await import("@/server/services/matching-service");
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
    hostOrgId = host.id;
    siteId = host.sites[0].id;

    const program = await prisma.program.create({
      data: { code: `${runId}-PRG`, name: testScopedName(runId, "Decision Program") },
    });
    programId = program.id;

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

    const manager = await prisma.user.create({
      data: {
        email: `${runId}-manager@synthetic.example`,
        displayName: testScopedName(runId, "Shelter Manager"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: host.id, role: enums.Role.SHELTER_MANAGER },
        },
      },
    });
    shelterManagerId = manager.id;

    const supervisor = await prisma.user.create({
      data: {
        email: `${runId}-supervisor@synthetic.example`,
        displayName: testScopedName(runId, "Shelter Supervisor"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: host.id, role: enums.Role.SHELTER_SUPERVISOR },
        },
      },
    });
    shelterSupervisorId = supervisor.id;

    const otherOrg = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Other Shelter"),
        kind: enums.OrganizationKind.HOST,
        isSynthetic: true,
      },
    });
    const otherManager = await prisma.user.create({
      data: {
        email: `${runId}-manager2@synthetic.example`,
        displayName: testScopedName(runId, "Other Shelter Manager"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: otherOrg.id, role: enums.Role.SHELTER_MANAGER },
        },
      },
    });
    otherOrgManagerId = otherManager.id;

    accepting = await createFixture("accept", { status: "PROPOSED" });
    declining = await createFixture("decline", { status: "PROPOSED" });
    assisted = await createFixture("assist", { status: "PROPOSED" });
    drafted = await createFixture("draft", { status: "DRAFT" });
    stale = await createFixture("stale", {
      status: "PROPOSED",
      windowEndsAt: new Date(Date.now() - 86_400_000),
    });
    shelterApproving = await createFixture("shapprove", { status: "PROPOSED" });
    shelterChanging = await createFixture("shchange", { status: "PROPOSED" });
    shelterDeclining = await createFixture("shdecline", { status: "PROPOSED" });
    shelterWithdrawing = await createFixture("shwithdraw", { status: "PROPOSED" });
  }, 60_000);

  afterAll(async () => {
    const emails = { startsWith: `${runId}-` };
    await prisma.placementMatchEvent.deleteMany({
      where: {
        placementMatch: { participant: { person: { user: { email: emails } } } },
      },
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
  }, 40_000);

  it("records the participant's own accept: track moves, match stays Proposed (AC1)", async () => {
    const ctx = await contextFor(accepting.userId);
    await service.recordParticipantDecision(ctx, accepting.matchId, {
      decision: "ACCEPTED",
    });

    const row = await prisma.placementMatch.findUniqueOrThrow({
      where: { id: accepting.matchId },
    });
    expect(row.participantDecision).toBe(enums.ParticipantMatchDecision.ACCEPTED);
    expect(row.status).toBe(enums.MatchStatus.PROPOSED);
    expect(row.participantDecisionAt).toBeInstanceOf(Date);
    expect(row.participantDecisionRecordedByUserId).toBe(accepting.userId);

    // The decision moment lands in the lifecycle trail even without a
    // status change, and in the audit log with a non-sensitive summary.
    const event = await prisma.placementMatchEvent.findFirstOrThrow({
      where: { placementMatchId: accepting.matchId, actorUserId: accepting.userId },
    });
    expect(event.fromStatus).toBe(enums.MatchStatus.PROPOSED);
    expect(event.toStatus).toBe(enums.MatchStatus.PROPOSED);
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: {
        action: "placementMatch.participantDecision",
        subjectId: accepting.matchId,
      },
    });
    expect(audit.actorUserId).toBe(accepting.userId);
    expect(audit.detail).toBe("accepted");

    // The participant's own view now renders the accepted waiting state.
    const view = await service.getOwnProposedMatch(ctx);
    expect(view?.participantDecision).toBe("ACCEPTED");
  }, 20_000);

  it("is one-way for the current proposal — a second decision is rejected (AC4)", async () => {
    const ctx = await contextFor(accepting.userId);
    await expect(
      service.recordParticipantDecision(ctx, accepting.matchId, { decision: "DECLINED" }),
    ).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.stringContaining("already been recorded"),
    });
  }, 20_000);

  it("treats a decline as a unilateral veto and keeps the note away from the shelter (AC2/AC6)", async () => {
    const ctx = await contextFor(declining.userId);
    await service.recordParticipantDecision(ctx, declining.matchId, {
      decision: "DECLINED",
      note: DECLINE_NOTE,
    });

    const row = await prisma.placementMatch.findUniqueOrThrow({
      where: { id: declining.matchId },
    });
    expect(row.status).toBe(enums.MatchStatus.DECLINED);
    expect(row.participantDecision).toBe(enums.ParticipantMatchDecision.DECLINED);
    expect(row.participantDecisionNote).toBe(DECLINE_NOTE);

    const event = await prisma.placementMatchEvent.findFirstOrThrow({
      where: {
        placementMatchId: declining.matchId,
        toStatus: enums.MatchStatus.DECLINED,
      },
    });
    expect(event.fromStatus).toBe(enums.MatchStatus.PROPOSED);
    expect(event.actorUserId).toBe(declining.userId);

    // Audit detail summarizes the decision but never carries the note.
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: {
        action: "placementMatch.participantDecision",
        subjectId: declining.matchId,
      },
    });
    expect(audit.detail).toBe("declined");
    expect(JSON.stringify(audit)).not.toContain("Prefers");

    // Gone from the shelter's approvals; the note appears nowhere in that
    // payload either. Operations, by contrast, can read it (AC6).
    const shelterCtx = await contextFor(shelterManagerId);
    const approvals = await service.listShelterApprovals(shelterCtx);
    expect(approvals.find((m) => m.id === declining.matchId)).toBeUndefined();
    expect(JSON.stringify(approvals)).not.toContain("Prefers");

    const coordinatorCtx = await contextFor(coordinatorId);
    const workspace = await service.getMatchWorkspace(coordinatorCtx, declining.matchId);
    expect(workspace.participantDecisionNote).toBe(DECLINE_NOTE);
    expect(workspace.participantDecisionRecordedByStaff).toBe(false);
    expect(workspace.participantDecisionLabel).toBe("Declined");

    // And the participant is awaiting match in the queue again.
    const queue = await service.getMatchingQueue(coordinatorCtx);
    const candidate = queue.candidates.find(
      (c) => c.enrollmentId === declining.enrollmentId,
    );
    expect(candidate?.state).toBe("AWAITING_MATCH");
  }, 30_000);

  it("shows the participant a time-boxed declined notice, not a permanent flag", async () => {
    const ctx = await contextFor(declining.userId);
    const notice = await service.getOwnDeclinedPlacementNotice(ctx);
    expect(notice?.organizationName).toContain("Host Shelter");

    // Older than one decision window: the dashboard lets it go.
    await prisma.placementMatch.update({
      where: { id: declining.matchId },
      data: { participantDecisionAt: new Date(Date.now() - 20 * 86_400_000) },
    });
    expect(await service.getOwnDeclinedPlacementNotice(ctx)).toBeNull();
  }, 20_000);

  it("lets a coordinator record an assisted decision with actor and owner distinct (AC3)", async () => {
    const coordinatorCtx = await contextFor(coordinatorId);
    await service.recordParticipantDecision(coordinatorCtx, assisted.matchId, {
      decision: "ACCEPTED",
      note: "Accepted by phone on Friday",
    });

    const row = await prisma.placementMatch.findUniqueOrThrow({
      where: { id: assisted.matchId },
    });
    expect(row.participantDecision).toBe(enums.ParticipantMatchDecision.ACCEPTED);
    expect(row.participantDecisionRecordedByUserId).toBe(coordinatorId);

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: {
        action: "placementMatch.participantDecision",
        subjectId: assisted.matchId,
      },
    });
    expect(audit.actorUserId).toBe(coordinatorId);
    expect(audit.detail).toContain("recorded by staff on the participant's behalf");
    expect(JSON.stringify(audit)).not.toContain("Friday");

    const workspace = await service.getMatchWorkspace(coordinatorCtx, assisted.matchId);
    expect(workspace.participantDecisionRecordedByStaff).toBe(true);
  }, 20_000);

  it("rejects decisions on a match that is not Proposed (AC4)", async () => {
    const ctx = await contextFor(drafted.userId);
    await expect(
      service.recordParticipantDecision(ctx, drafted.matchId, { decision: "ACCEPTED" }),
    ).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.stringContaining("while a match is proposed"),
    });
  }, 20_000);

  it("denies anyone who is neither the owner nor assisting staff (AC5)", async () => {
    const otherParticipantCtx = await contextFor(declining.userId);
    await expect(
      service.recordParticipantDecision(otherParticipantCtx, accepting.matchId, {
        decision: "DECLINED",
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });

    const shelterCtx = await contextFor(shelterManagerId);
    await expect(
      service.recordParticipantDecision(shelterCtx, accepting.matchId, {
        decision: "ACCEPTED",
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
  }, 20_000);

  it("expires a stale proposal on access instead of accepting a late decision (4.4 AC5)", async () => {
    const ctx = await contextFor(stale.userId);
    await expect(
      service.recordParticipantDecision(ctx, stale.matchId, { decision: "ACCEPTED" }),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });

    const row = await prisma.placementMatch.findUniqueOrThrow({
      where: { id: stale.matchId },
    });
    expect(row.status).toBe(enums.MatchStatus.EXPIRED);
    expect(row.participantDecision).toBe(enums.ParticipantMatchDecision.PENDING);
  }, 20_000);

  // --- Shelter decision (Story 4.6) ---------------------------------------------

  it("records a manager approval: track moves, match stays Proposed (4.6 AC1)", async () => {
    const ctx = await contextFor(shelterManagerId);
    await service.recordShelterDecision(ctx, shelterApproving.matchId, {
      decision: "APPROVED",
    });

    const row = await prisma.placementMatch.findUniqueOrThrow({
      where: { id: shelterApproving.matchId },
    });
    expect(row.shelterDecision).toBe(enums.ShelterMatchDecision.APPROVED);
    expect(row.status).toBe(enums.MatchStatus.PROPOSED);
    expect(row.shelterDecisionAt).toBeInstanceOf(Date);
    expect(row.shelterDecisionRecordedByUserId).toBe(shelterManagerId);

    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: {
        action: "placementMatch.shelterDecision",
        subjectId: shelterApproving.matchId,
      },
    });
    expect(audit.actorUserId).toBe(shelterManagerId);
    expect(audit.detail).toBe("approved");

    // Still on the approvals list, now showing the recorded decision.
    const approvals = await service.listShelterApprovals(ctx);
    const rowView = approvals.find((m) => m.id === shelterApproving.matchId);
    expect(rowView?.shelterDecisionLabel).toBe("Approved");
    expect(rowView?.viewerCanDecide).toBe(true);
  }, 20_000);

  it("is one-way for the shelter track too (4.6 AC6)", async () => {
    const ctx = await contextFor(shelterManagerId);
    await expect(
      service.recordShelterDecision(ctx, shelterApproving.matchId, {
        decision: "DECLINED",
        note: "changed our minds",
      }),
    ).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.stringContaining("already been recorded"),
    });
  }, 20_000);

  it("routes a change request to the coordinator with its required note (4.6 AC2)", async () => {
    const ctx = await contextFor(shelterManagerId);

    // The note is required — its absence is a named validation error.
    await expect(
      service.recordShelterDecision(ctx, shelterChanging.matchId, {
        decision: "CHANGE_REQUESTED",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("Add a note for the coordinator"),
    });

    await service.recordShelterDecision(ctx, shelterChanging.matchId, {
      decision: "CHANGE_REQUESTED",
      note: "Weekend mornings work better for our intake schedule",
    });

    const row = await prisma.placementMatch.findUniqueOrThrow({
      where: { id: shelterChanging.matchId },
    });
    expect(row.status).toBe(enums.MatchStatus.CHANGE_REQUESTED);
    expect(row.shelterDecision).toBe(enums.ShelterMatchDecision.CHANGE_REQUESTED);
    expect(row.shelterDecisionNote).toContain("Weekend mornings");

    const event = await prisma.placementMatchEvent.findFirstOrThrow({
      where: {
        placementMatchId: shelterChanging.matchId,
        toStatus: enums.MatchStatus.CHANGE_REQUESTED,
      },
    });
    expect(event.fromStatus).toBe(enums.MatchStatus.PROPOSED);

    // Off the approvals list (it is with the coordinator now); the note
    // never enters audit detail; Operations reads it in the workspace.
    const approvals = await service.listShelterApprovals(ctx);
    expect(approvals.find((m) => m.id === shelterChanging.matchId)).toBeUndefined();
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: {
        action: "placementMatch.shelterDecision",
        subjectId: shelterChanging.matchId,
      },
    });
    expect(audit.detail).toBe("change requested");
    expect(JSON.stringify(audit)).not.toContain("Weekend");

    const coordinatorCtx = await contextFor(coordinatorId);
    const workspace = await service.getMatchWorkspace(
      coordinatorCtx,
      shelterChanging.matchId,
    );
    expect(workspace.shelterDecisionNote).toContain("Weekend mornings");
    expect(workspace.shelterDecisionLabel).toBe("Change requested");
  }, 30_000);

  it("treats a shelter decline as a unilateral veto (4.6 AC3)", async () => {
    const ctx = await contextFor(shelterManagerId);
    await service.recordShelterDecision(ctx, shelterDeclining.matchId, {
      decision: "DECLINED",
      note: "We can't supervise additional staff this season",
    });

    const row = await prisma.placementMatch.findUniqueOrThrow({
      where: { id: shelterDeclining.matchId },
    });
    expect(row.status).toBe(enums.MatchStatus.DECLINED);
    expect(row.shelterDecision).toBe(enums.ShelterMatchDecision.DECLINED);
    // The participant track never moved — the veto is the shelter's alone.
    expect(row.participantDecision).toBe(enums.ParticipantMatchDecision.PENDING);
  }, 20_000);

  it("gives supervisors view without decide (4.6 AC4)", async () => {
    const ctx = await contextFor(shelterSupervisorId);

    const approvals = await service.listShelterApprovals(ctx);
    const anyRow = approvals.find((m) => m.id === accepting.matchId);
    expect(anyRow).toBeTruthy();
    expect(anyRow?.viewerCanDecide).toBe(false);

    await expect(
      service.recordShelterDecision(ctx, accepting.matchId, { decision: "APPROVED" }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
  }, 20_000);

  it("denies a different shelter's manager and Nova staff alike (4.6 AC5)", async () => {
    const otherCtx = await contextFor(otherOrgManagerId);
    await expect(
      service.recordShelterDecision(otherCtx, accepting.matchId, {
        decision: "APPROVED",
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
    // Their own approvals list contains nothing from the host org.
    const approvals = await service.listShelterApprovals(otherCtx);
    expect(approvals).toHaveLength(0);

    const coordinatorCtx = await contextFor(coordinatorId);
    await expect(
      service.recordShelterDecision(coordinatorCtx, accepting.matchId, {
        decision: "APPROVED",
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
  }, 20_000);

  it("rejects shelter decisions on a match that is not Proposed (4.6 AC6)", async () => {
    const ctx = await contextFor(shelterManagerId);
    await expect(
      service.recordShelterDecision(ctx, drafted.matchId, {
        decision: "DECLINED",
        note: "not workable",
      }),
    ).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.stringContaining("while a match is proposed"),
    });
  }, 20_000);

  // --- Request changes (Story 4.7) ------------------------------------------------
  // shelterChanging is CHANGE_REQUESTED here, carrying the 4.6 note.

  it("shows the participant plain revising language while change-requested (4.7 AC4)", async () => {
    const ctx = await contextFor(shelterChanging.userId);
    const view = await service.getOwnProposedMatch(ctx);
    expect(view?.revising).toBe(true);
    // The shelter's internal note never reaches the participant payload.
    expect(JSON.stringify(view)).not.toContain("Weekend");
  }, 20_000);

  it("lets the coordinator edit a change-requested match without moving it (4.7 AC1/AC2)", async () => {
    const coordinatorCtx = await contextFor(coordinatorId);

    // AC1: the note and the prior terms are both in the workspace view.
    const before = await service.getMatchWorkspace(coordinatorCtx, shelterChanging.matchId);
    expect(before.shelterDecisionNote).toContain("Weekend mornings");
    expect(before.schedule).toBe("Mon/Wed mornings");

    await service.updateMatchDraft(coordinatorCtx, shelterChanging.matchId, {
      siteId,
      supervisorId: shelterManagerId,
      schedule: "Sat/Sun mornings",
      startDate: new Date("2026-08-03T00:00:00Z"),
      endDate: new Date("2026-12-04T00:00:00Z"),
      fundingSourceId: null,
      notes: null,
    });

    const row = await prisma.placementMatch.findUniqueOrThrow({
      where: { id: shelterChanging.matchId },
    });
    expect(row.status).toBe(enums.MatchStatus.CHANGE_REQUESTED);
    expect(row.proposedSchedule).toBe("Sat/Sun mornings");
    await prisma.auditEvent.findFirstOrThrow({
      where: {
        action: "placementMatch.update",
        subjectId: shelterChanging.matchId,
        detail: "revision-edited",
      },
    });

    // A shelter manager cannot edit or re-propose (AC6).
    const managerCtx = await contextFor(shelterManagerId);
    await expect(
      service.updateMatchDraft(managerCtx, shelterChanging.matchId, {
        siteId,
        supervisorId: null,
        schedule: null,
        startDate: null,
        endDate: null,
        fundingSourceId: null,
        notes: null,
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
    await expect(
      service.reproposeMatch(managerCtx, shelterChanging.matchId),
    ).rejects.toMatchObject({ code: "AUTHORIZATION" });
  }, 30_000);

  it("re-proposes with both tracks reset and the prior cycle archived (4.7 AC2)", async () => {
    const coordinatorCtx = await contextFor(coordinatorId);

    // The 4.4 completeness gate applies: clear a core field, watch it named.
    await service.updateMatchDraft(coordinatorCtx, shelterChanging.matchId, {
      siteId,
      supervisorId: null,
      schedule: "Sat/Sun mornings",
      startDate: new Date("2026-08-03T00:00:00Z"),
      endDate: new Date("2026-12-04T00:00:00Z"),
      fundingSourceId: null,
      notes: null,
    });
    await expect(
      service.reproposeMatch(coordinatorCtx, shelterChanging.matchId),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringContaining("Candidate supervisor"),
    });

    await service.updateMatchDraft(coordinatorCtx, shelterChanging.matchId, {
      siteId,
      supervisorId: shelterManagerId,
      schedule: "Sat/Sun mornings",
      startDate: new Date("2026-08-03T00:00:00Z"),
      endDate: new Date("2026-12-04T00:00:00Z"),
      fundingSourceId: null,
      notes: null,
    });
    await service.reproposeMatch(coordinatorCtx, shelterChanging.matchId);

    const row = await prisma.placementMatch.findUniqueOrThrow({
      where: { id: shelterChanging.matchId },
    });
    expect(row.status).toBe(enums.MatchStatus.PROPOSED);
    expect(row.participantDecision).toBe(enums.ParticipantMatchDecision.PENDING);
    expect(row.shelterDecision).toBe(enums.ShelterMatchDecision.PENDING);
    // Archive-then-reset: per-cycle fields cleared on the row...
    expect(row.shelterDecisionNote).toBeNull();
    expect(row.shelterDecisionAt).toBeNull();
    expect(row.decisionWindowEndsAt!.getTime()).toBeGreaterThan(Date.now());

    // ...with the outgoing cycle preserved verbatim in the event trail.
    const event = await prisma.placementMatchEvent.findFirstOrThrow({
      where: {
        placementMatchId: shelterChanging.matchId,
        fromStatus: enums.MatchStatus.CHANGE_REQUESTED,
        toStatus: enums.MatchStatus.PROPOSED,
      },
    });
    expect(event.detail).toContain("shelter: Change requested");
    expect(event.detail).toContain("Weekend mornings");
    await prisma.auditEvent.findFirstOrThrow({
      where: { action: "placementMatch.repropose", subjectId: shelterChanging.matchId },
    });

    // Fresh cycle on both sides: the shelter sees it pending again, and
    // the participant is out of the revising state.
    const managerCtx = await contextFor(shelterManagerId);
    const approvals = await service.listShelterApprovals(managerCtx);
    const rowView = approvals.find((m) => m.id === shelterChanging.matchId);
    expect(rowView?.shelterDecisionLabel).toBe("Pending");
    const participantCtx = await contextFor(shelterChanging.userId);
    const view = await service.getOwnProposedMatch(participantCtx);
    expect(view?.revising).toBe(false);
    expect(view?.participantDecision).toBe("PENDING");
  }, 30_000);

  it("rejects re-propose off Change Requested (4.7 AC5)", async () => {
    const coordinatorCtx = await contextFor(coordinatorId);
    await expect(
      service.reproposeMatch(coordinatorCtx, accepting.matchId),
    ).rejects.toMatchObject({
      code: "LIFECYCLE",
      message: expect.stringContaining("change-requested"),
    });
    await expect(
      service.reproposeMatch(coordinatorCtx, drafted.matchId),
    ).rejects.toMatchObject({ code: "LIFECYCLE" });
  }, 20_000);

  it("withdraws a change-requested match and returns the participant to the queue (4.7 AC3)", async () => {
    const managerCtx = await contextFor(shelterManagerId);
    await service.recordShelterDecision(managerCtx, shelterWithdrawing.matchId, {
      decision: "CHANGE_REQUESTED",
      note: "Site is under renovation this fall",
    });

    const coordinatorCtx = await contextFor(coordinatorId);
    await service.withdrawMatchDraft(coordinatorCtx, shelterWithdrawing.matchId);

    const row = await prisma.placementMatch.findUniqueOrThrow({
      where: { id: shelterWithdrawing.matchId },
    });
    expect(row.status).toBe(enums.MatchStatus.WITHDRAWN);

    const event = await prisma.placementMatchEvent.findFirstOrThrow({
      where: {
        placementMatchId: shelterWithdrawing.matchId,
        toStatus: enums.MatchStatus.WITHDRAWN,
      },
    });
    expect(event.fromStatus).toBe(enums.MatchStatus.CHANGE_REQUESTED);
    expect(event.detail).toContain("renovation");

    const queue = await service.getMatchingQueue(coordinatorCtx);
    const candidate = queue.candidates.find(
      (c) => c.enrollmentId === shelterWithdrawing.enrollmentId,
    );
    expect(candidate?.state).toBe("AWAITING_MATCH");
  }, 30_000);
});
