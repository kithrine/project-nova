-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('DRAFT', 'PROPOSED', 'APPROVED', 'CHANGE_REQUESTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ParticipantMatchDecision" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ShelterMatchDecision" AS ENUM ('PENDING', 'APPROVED', 'CHANGE_REQUESTED', 'DECLINED');

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_certificationId_fkey";

-- AlterTable
ALTER TABLE "OrganizationSite" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PlacementMatch" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "programEnrollmentId" TEXT NOT NULL,
    "hostOrganizationId" TEXT NOT NULL,
    "organizationSiteId" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'DRAFT',
    "participantDecision" "ParticipantMatchDecision" NOT NULL DEFAULT 'PENDING',
    "shelterDecision" "ShelterMatchDecision" NOT NULL DEFAULT 'PENDING',
    "proposedSupervisorId" TEXT,
    "proposedSchedule" TEXT,
    "proposedStartDate" DATE,
    "proposedEndDate" DATE,
    "candidateFundingSourceId" TEXT,
    "compatibilitySnapshot" TEXT,
    "coordinatorNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlacementMatch_participantId_idx" ON "PlacementMatch"("participantId");

-- CreateIndex
CREATE INDEX "PlacementMatch_hostOrganizationId_idx" ON "PlacementMatch"("hostOrganizationId");

-- CreateIndex
CREATE INDEX "PlacementMatch_organizationSiteId_idx" ON "PlacementMatch"("organizationSiteId");

-- AddForeignKey
ALTER TABLE "PlacementMatch" ADD CONSTRAINT "PlacementMatch_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementMatch" ADD CONSTRAINT "PlacementMatch_programEnrollmentId_fkey" FOREIGN KEY ("programEnrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementMatch" ADD CONSTRAINT "PlacementMatch_hostOrganizationId_fkey" FOREIGN KEY ("hostOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementMatch" ADD CONSTRAINT "PlacementMatch_organizationSiteId_fkey" FOREIGN KEY ("organizationSiteId") REFERENCES "OrganizationSite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementMatch" ADD CONSTRAINT "PlacementMatch_candidateFundingSourceId_fkey" FOREIGN KEY ("candidateFundingSourceId") REFERENCES "FundingSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- At most ONE non-terminal match per participant (Story 4.3's rule,
-- enforced from day one): mirrors the one-active-placement partial-unique
-- pattern in docs/architecture/database-design.md.
CREATE UNIQUE INDEX "PlacementMatch_one_non_terminal_per_participant"
ON "PlacementMatch"("participantId")
WHERE "status" IN ('DRAFT', 'PROPOSED', 'CHANGE_REQUESTED');
