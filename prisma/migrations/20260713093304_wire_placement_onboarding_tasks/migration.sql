-- CreateIndex
CREATE INDEX "OnboardingTask_placementId_idx" ON "OnboardingTask"("placementId");

-- AddForeignKey
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
