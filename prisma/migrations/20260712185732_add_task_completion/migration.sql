-- AlterTable
ALTER TABLE "OnboardingTask" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedByUserId" TEXT;
