-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_certificationId_fkey";

-- DropForeignKey
ALTER TABLE "PlacementMatch" DROP CONSTRAINT "PlacementMatch_candidateFundingSourceId_fkey";

-- AddForeignKey
ALTER TABLE "PlacementMatch" ADD CONSTRAINT "PlacementMatch_candidateFundingSourceId_fkey" FOREIGN KEY ("candidateFundingSourceId") REFERENCES "FundingSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
