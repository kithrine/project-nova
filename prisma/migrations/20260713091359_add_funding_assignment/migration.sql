-- CreateEnum
CREATE TYPE "FundingAssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "FundingAssignment" (
    "id" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "fundingSourceId" TEXT NOT NULL,
    "status" "FundingAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "hourlyRate" DECIMAL(8,2),
    "hoursCap" DECIMAL(7,2),
    "assignedByUserId" TEXT NOT NULL,
    "endedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FundingAssignment_placementId_idx" ON "FundingAssignment"("placementId");

-- CreateIndex
CREATE INDEX "FundingAssignment_fundingSourceId_idx" ON "FundingAssignment"("fundingSourceId");

-- AddForeignKey
ALTER TABLE "FundingAssignment" ADD CONSTRAINT "FundingAssignment_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingAssignment" ADD CONSTRAINT "FundingAssignment_fundingSourceId_fkey" FOREIGN KEY ("fundingSourceId") REFERENCES "FundingSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exactly one ACTIVE funding assignment per placement (ADR-010;
-- docs/architecture/database-design.md). Partial unique indexes are not
-- expressible in the Prisma schema, so this lives here — the database
-- backstop behind the application-level check in the assign path.
CREATE UNIQUE INDEX "FundingAssignment_one_active_per_placement"
  ON "FundingAssignment"("placementId")
  WHERE "status" = 'ACTIVE';
