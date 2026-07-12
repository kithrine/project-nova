-- CreateEnum
CREATE TYPE "EligibilityOutcome" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE');

-- CreateTable
CREATE TABLE "EligibilityReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "outcome" "EligibilityOutcome",
    "rationale" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EligibilityReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityReview_applicationId_key" ON "EligibilityReview"("applicationId");

-- AddForeignKey
ALTER TABLE "EligibilityReview" ADD CONSTRAINT "EligibilityReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
