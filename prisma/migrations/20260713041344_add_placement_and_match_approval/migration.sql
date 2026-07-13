-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('DRAFT', 'PROPOSED', 'SHELTER_REVIEW', 'APPROVED', 'ONBOARDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CONVERTED_TO_PERMANENT', 'WITHDRAWN', 'TERMINATED');

-- AlterTable
ALTER TABLE "PlacementMatch" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT;

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "placementNumber" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "programEnrollmentId" TEXT NOT NULL,
    "hostOrganizationId" TEXT NOT NULL,
    "organizationSiteId" TEXT NOT NULL,
    "sourceMatchId" TEXT NOT NULL,
    "status" "PlacementStatus" NOT NULL DEFAULT 'DRAFT',
    "supervisorId" TEXT,
    "schedule" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "fundingSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementEvent" (
    "id" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "fromStatus" "PlacementStatus",
    "toStatus" "PlacementStatus" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Placement_placementNumber_key" ON "Placement"("placementNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Placement_sourceMatchId_key" ON "Placement"("sourceMatchId");

-- CreateIndex
CREATE INDEX "Placement_participantId_idx" ON "Placement"("participantId");

-- CreateIndex
CREATE INDEX "Placement_hostOrganizationId_idx" ON "Placement"("hostOrganizationId");

-- CreateIndex
CREATE INDEX "Placement_organizationSiteId_idx" ON "Placement"("organizationSiteId");

-- CreateIndex
CREATE INDEX "PlacementEvent_placementId_idx" ON "PlacementEvent"("placementId");

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_programEnrollmentId_fkey" FOREIGN KEY ("programEnrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_hostOrganizationId_fkey" FOREIGN KEY ("hostOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_organizationSiteId_fkey" FOREIGN KEY ("organizationSiteId") REFERENCES "OrganizationSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_sourceMatchId_fkey" FOREIGN KEY ("sourceMatchId") REFERENCES "PlacementMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_fundingSourceId_fkey" FOREIGN KEY ("fundingSourceId") REFERENCES "FundingSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementEvent" ADD CONSTRAINT "PlacementEvent_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One onboarding/active/paused placement per participant
-- (docs/architecture/database-design.md; docs/product/business-rules.md).
-- Partial unique indexes are not expressible in the Prisma schema, so this
-- lives here — the hard backstop behind the application-level re-check in
-- the Story 4.8 approval transaction.
CREATE UNIQUE INDEX "Placement_one_active_per_participant"
  ON "Placement"("participantId")
  WHERE "status" IN ('ONBOARDING', 'ACTIVE', 'PAUSED');
