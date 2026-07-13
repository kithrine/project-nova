-- AlterTable
ALTER TABLE "PlacementMatch" ADD COLUMN     "shelterDecisionAt" TIMESTAMP(3),
ADD COLUMN     "shelterDecisionNote" TEXT,
ADD COLUMN     "shelterDecisionRecordedByUserId" TEXT;
