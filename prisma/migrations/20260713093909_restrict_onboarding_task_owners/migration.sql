-- DropForeignKey
ALTER TABLE "OnboardingTask" DROP CONSTRAINT "OnboardingTask_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "OnboardingTask" DROP CONSTRAINT "OnboardingTask_placementId_fkey";

-- AddForeignKey
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
