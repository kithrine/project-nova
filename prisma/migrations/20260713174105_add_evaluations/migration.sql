-- CreateEnum
CREATE TYPE "EvaluationRating" AS ENUM ('NEEDS_SUPPORT', 'DEVELOPING', 'MEETS_EXPECTATIONS', 'EXCEEDS_EXPECTATIONS');

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "evaluationDate" DATE NOT NULL,
    "reliabilityRating" "EvaluationRating" NOT NULL,
    "taskQualityRating" "EvaluationRating" NOT NULL,
    "teamworkRating" "EvaluationRating" NOT NULL,
    "strengths" TEXT NOT NULL,
    "growthAreas" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evaluation_placementId_idx" ON "Evaluation"("placementId");

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
