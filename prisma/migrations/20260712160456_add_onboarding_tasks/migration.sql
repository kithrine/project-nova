-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('NOT_STARTED', 'COMPLETE');

-- CreateTable
CREATE TABLE "OnboardingTaskTemplate" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "participantCompletable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTask" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "placementId" TEXT,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL,
    "participantCompletable" BOOLEAN NOT NULL,
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingTaskTemplate_programId_idx" ON "OnboardingTaskTemplate"("programId");

-- CreateIndex
CREATE INDEX "OnboardingTask_enrollmentId_idx" ON "OnboardingTask"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingTask_enrollmentId_templateId_key" ON "OnboardingTask"("enrollmentId", "templateId");

-- AddForeignKey
ALTER TABLE "OnboardingTaskTemplate" ADD CONSTRAINT "OnboardingTaskTemplate_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- XOR ownership (Story 3.2; database-design.md): every onboarding task has
-- EXACTLY one owning context — an enrollment or (from Epic 5) a placement.
-- Prisma cannot express CHECK constraints, so it lives here.
ALTER TABLE "OnboardingTask"
  ADD CONSTRAINT "OnboardingTask_owner_xor"
  CHECK (((("enrollmentId" IS NOT NULL))::int + ((("placementId" IS NOT NULL))::int)) = 1);
