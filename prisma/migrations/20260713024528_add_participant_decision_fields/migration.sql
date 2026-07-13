-- AlterTable
ALTER TABLE "PlacementMatch" ADD COLUMN     "participantDecisionAt" TIMESTAMP(3),
ADD COLUMN     "participantDecisionNote" TEXT,
ADD COLUMN     "participantDecisionRecordedByUserId" TEXT;
