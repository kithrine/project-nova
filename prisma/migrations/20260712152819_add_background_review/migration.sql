-- CreateEnum
CREATE TYPE "BackgroundOutcome" AS ENUM ('CLEAR', 'DISQUALIFYING');

-- CreateTable
CREATE TABLE "BackgroundReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "outcome" "BackgroundOutcome" NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundReview_applicationId_key" ON "BackgroundReview"("applicationId");

-- AddForeignKey
ALTER TABLE "BackgroundReview" ADD CONSTRAINT "BackgroundReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
