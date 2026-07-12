import { del, put } from "@vercel/blob";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestRunId, testScopedName } from "../helpers/test-run";

/**
 * Documents against real Neon + real Vercel Blob (Story 2.4, ADR-014):
 * confirm-after-upload verification, supersede-in-transaction, ownership
 * denial, lifecycle gating, reviewer download authorization, and the
 * partial unique index. Requires both DATABASE_URL and
 * BLOB_READ_WRITE_TOKEN; skips cleanly otherwise. Uploaded blobs are
 * tracked and deleted in cleanup (ADR-006 discipline, extended to storage).
 */
const hasInfra = Boolean(process.env.DATABASE_URL) && Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const runId = createTestRunId("doc24");

describe.skipIf(!hasInfra)("documents (integration)", () => {
  let prisma: (typeof import("@/server/database/prisma"))["prisma"];
  let service: typeof import("@/server/services/document-service");
  let appService: typeof import("@/server/services/application-service");
  let memberships: typeof import("@/server/repositories/membership-repository");
  let enums: typeof import("@/generated/prisma/enums");
  let errors: typeof import("@/server/errors/app-error");

  let ownerUserId: string;
  let strangerUserId: string;
  let reviewerUserId: string;
  let applicationId: string;
  const uploadedUrls: string[] = [];

  const PNG_BYTES = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );

  async function contextFor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      memberships: await memberships.listActiveMembershipsForUser(user.id),
    };
  }

  /** Simulate the direct client upload: put a real object under the authorized prefix. */
  async function uploadUnderPrefix(appId: string, type: (typeof enums.DocumentType)[keyof typeof enums.DocumentType]) {
    const prefix = service.uploadPathnamePrefix(appId, type);
    const blob = await put(`${prefix}document.png`, PNG_BYTES, {
      access: "private",
      addRandomSuffix: true,
      contentType: "image/png",
    });
    uploadedUrls.push(blob.url);
    return blob;
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/server/database/prisma"));
    service = await import("@/server/services/document-service");
    appService = await import("@/server/services/application-service");
    memberships = await import("@/server/repositories/membership-repository");
    enums = await import("@/generated/prisma/enums");
    errors = await import("@/server/errors/app-error");

    const owner = await prisma.user.create({
      data: {
        email: `${runId}-owner@synthetic.example`,
        displayName: testScopedName(runId, "Owner"),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Doc",
            legalLastName: testScopedName(runId, "Owner"),
            dateOfBirth: new Date("1990-01-01T00:00:00Z"),
          },
        },
      },
    });
    const stranger = await prisma.user.create({
      data: {
        email: `${runId}-stranger@synthetic.example`,
        displayName: testScopedName(runId, "Stranger"),
        isSynthetic: true,
        person: {
          create: {
            legalFirstName: "Doc",
            legalLastName: testScopedName(runId, "Stranger"),
            dateOfBirth: new Date("1990-01-01T00:00:00Z"),
          },
        },
      },
    });
    const nova = await prisma.organization.create({
      data: {
        name: testScopedName(runId, "Nova Org"),
        kind: enums.OrganizationKind.NOVA,
        isSynthetic: true,
      },
    });
    const reviewer = await prisma.user.create({
      data: {
        email: `${runId}-reviewer@synthetic.example`,
        displayName: testScopedName(runId, "Reviewer"),
        isSynthetic: true,
        memberships: {
          create: { organizationId: nova.id, role: enums.Role.PROGRAM_COORDINATOR },
        },
      },
    });
    ownerUserId = owner.id;
    strangerUserId = stranger.id;
    reviewerUserId = reviewer.id;

    const draft = await appService.startOrResumeApplication(await contextFor(ownerUserId));
    applicationId = draft.id;
  });

  afterAll(async () => {
    if (uploadedUrls.length > 0) {
      await del(uploadedUrls).catch(() => {});
    }
    await prisma.document.deleteMany({
      where: { application: { person: { user: { email: { startsWith: `${runId}-` } } } } },
    });
    await prisma.application.deleteMany({
      where: { person: { user: { email: { startsWith: `${runId}-` } } } },
    });
    await prisma.person.deleteMany({
      where: { user: { email: { startsWith: `${runId}-` } } },
    });
    await prisma.membership.deleteMany({
      where: { user: { email: { startsWith: `${runId}-` } } },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: `${runId}-` } } });
    await prisma.organization.deleteMany({ where: { name: { contains: runId } } });
    await prisma.$disconnect();
  });

  it("confirms a real upload: server-side verification creates metadata only", async () => {
    const ctx = await contextFor(ownerUserId);
    const blob = await uploadUnderPrefix(applicationId, enums.DocumentType.GOVERNMENT_ID);

    const view = await service.confirmUpload(ctx, {
      applicationId,
      documentType: enums.DocumentType.GOVERNMENT_ID,
      pathname: blob.pathname,
    });

    expect(view.status).toBe(enums.DocumentStatus.ACTIVE);
    expect(view.contentType).toBe("image/png");
    expect(view.sizeBytes).toBe(PNG_BYTES.length);
    expect(JSON.stringify(view)).not.toContain("vercel-storage");

    // Idempotent replay returns the same record.
    const replay = await service.confirmUpload(ctx, {
      applicationId,
      documentType: enums.DocumentType.GOVERNMENT_ID,
      pathname: blob.pathname,
    });
    expect(replay.id).toBe(view.id);
  });

  it("supersedes the prior document on replacement — archived, not deleted", async () => {
    const ctx = await contextFor(ownerUserId);
    const replacement = await uploadUnderPrefix(applicationId, enums.DocumentType.GOVERNMENT_ID);

    await service.confirmUpload(ctx, {
      applicationId,
      documentType: enums.DocumentType.GOVERNMENT_ID,
      pathname: replacement.pathname,
    });

    const rows = await prisma.document.findMany({
      where: { applicationId, documentType: enums.DocumentType.GOVERNMENT_ID },
      orderBy: { createdAt: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe(enums.DocumentStatus.SUPERSEDED);
    expect(rows[0].supersededAt).toBeInstanceOf(Date);
    expect(rows[1].status).toBe(enums.DocumentStatus.ACTIVE);

    const checklist = await service.getDocumentChecklist(ctx, applicationId);
    const idItem = checklist.find(
      (i) => i.documentType === enums.DocumentType.GOVERNMENT_ID,
    );
    expect(idItem?.current?.id).toBe(rows[1].id);
  });

  it("enforces one ACTIVE document per type at the database layer", async () => {
    await expect(
      prisma.document.create({
        data: {
          applicationId,
          documentType: enums.DocumentType.GOVERNMENT_ID,
          fileName: "dup.png",
          contentType: "image/png",
          sizeBytes: 1,
          storagePathname: `${runId}-dup-path`,
          storageUrl: "https://example.invalid/dup",
          uploadedByUserId: ownerUserId,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("denies a stranger's confirm and download attempts without leaking existence", async () => {
    const strangerCtx = await contextFor(strangerUserId);
    const activeDoc = await prisma.document.findFirstOrThrow({
      where: { applicationId, status: enums.DocumentStatus.ACTIVE },
    });

    await expect(
      service.confirmUpload(strangerCtx, {
        applicationId,
        documentType: enums.DocumentType.GOVERNMENT_ID,
        pathname: activeDoc.storagePathname,
      }),
    ).rejects.toBeInstanceOf(errors.NotFoundError);

    await expect(
      service.authorizeDownload(strangerCtx, activeDoc.id),
    ).rejects.toBeInstanceOf(errors.NotFoundError);
  });

  it("authorizes downloads for the owner and for a Nova reviewer with document.view", async () => {
    const activeDoc = await prisma.document.findFirstOrThrow({
      where: { applicationId, status: enums.DocumentStatus.ACTIVE },
    });

    const owner = await service.authorizeDownload(await contextFor(ownerUserId), activeDoc.id);
    expect(owner.storagePathname).toBe(activeDoc.storagePathname);

    const reviewer = await service.authorizeDownload(
      await contextFor(reviewerUserId),
      activeDoc.id,
    );
    expect(reviewer.fileName).toBe(activeDoc.fileName);
  });

  it("rejects a confirm whose pathname is outside the authorized prefix", async () => {
    const ctx = await contextFor(ownerUserId);
    await expect(
      service.confirmUpload(ctx, {
        applicationId,
        documentType: enums.DocumentType.GOVERNMENT_ID,
        pathname: "applications/someone-else/GOVERNMENT_ID/document.png",
      }),
    ).rejects.toBeInstanceOf(errors.AuthorizationError);
  });

  it("blocks uploads once the application is terminal", async () => {
    const ctx = await contextFor(ownerUserId);
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: enums.ApplicationStatus.REJECTED, decidedAt: new Date() },
    });

    await expect(
      service.authorizeUpload(ctx, applicationId, enums.DocumentType.GOVERNMENT_ID),
    ).rejects.toBeInstanceOf(errors.LifecycleError);
  });
});

describe.skipIf(hasInfra)("documents (unconfigured)", () => {
  it("is skipped because DATABASE_URL or BLOB_READ_WRITE_TOKEN is not set", () => {
    expect(hasInfra).toBe(false);
  });
});
