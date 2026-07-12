-- CreateEnum
CREATE TYPE "TrainingEnrollmentStatus" AS ENUM ('ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TrainingCompletionMethod" AS ENUM ('KNOWLEDGE_ASSESSMENT', 'PROVIDER_VERIFICATION', 'OBSERVED_COMPETENCY', 'PRIOR_LEARNING_VERIFICATION');

-- CreateTable
CREATE TABLE "TrainingProgram" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requiredForMatching" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingEnrollment" (
    "id" TEXT NOT NULL,
    "programEnrollmentId" TEXT NOT NULL,
    "trainingProgramId" TEXT NOT NULL,
    "status" "TrainingEnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "enrolledAt" DATE NOT NULL,
    "expectedCompletionDate" DATE,
    "startedAt" DATE,
    "completedAt" DATE,
    "withdrawnAt" DATE,
    "providerName" TEXT,
    "completionMethod" "TrainingCompletionMethod",
    "completionVerifiedByUserId" TEXT,
    "completionVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingEnrollmentEvent" (
    "id" TEXT NOT NULL,
    "trainingEnrollmentId" TEXT NOT NULL,
    "fromStatus" "TrainingEnrollmentStatus",
    "toStatus" "TrainingEnrollmentStatus" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingEnrollmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingProgram_programId_sortOrder_idx" ON "TrainingProgram"("programId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingProgram_programId_code_key" ON "TrainingProgram"("programId", "code");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_programEnrollmentId_idx" ON "TrainingEnrollment"("programEnrollmentId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_trainingProgramId_idx" ON "TrainingEnrollment"("trainingProgramId");

-- One current attempt per enrollment/program; terminal attempts remain as
-- immutable history and a later attempt may be created (ADR-017).
CREATE UNIQUE INDEX "TrainingEnrollment_one_active_attempt"
ON "TrainingEnrollment"("programEnrollmentId", "trainingProgramId")
WHERE "status" IN ('ENROLLED', 'IN_PROGRESS');

-- Current-state columns must agree with the lifecycle status. History lives
-- in TrainingEnrollmentEvent, while these columns describe the active snapshot.
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_date_order_check"
CHECK (
    ("expectedCompletionDate" IS NULL OR "expectedCompletionDate" >= "enrolledAt")
    AND ("startedAt" IS NULL OR "startedAt" >= "enrolledAt")
    AND ("completedAt" IS NULL OR "completedAt" >= COALESCE("startedAt", "enrolledAt"))
    AND ("withdrawnAt" IS NULL OR "withdrawnAt" >= COALESCE("startedAt", "enrolledAt"))
);

ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_status_fields_check"
CHECK (
    ("status" = 'ENROLLED' AND "startedAt" IS NULL AND "completedAt" IS NULL AND "withdrawnAt" IS NULL AND "completionMethod" IS NULL AND "completionVerifiedByUserId" IS NULL AND "completionVerifiedAt" IS NULL)
    OR ("status" = 'IN_PROGRESS' AND "startedAt" IS NOT NULL AND "completedAt" IS NULL AND "withdrawnAt" IS NULL AND "completionMethod" IS NULL AND "completionVerifiedByUserId" IS NULL AND "completionVerifiedAt" IS NULL)
    OR ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "withdrawnAt" IS NULL AND "completionMethod" IS NOT NULL AND "completionVerifiedByUserId" IS NOT NULL AND "completionVerifiedAt" IS NOT NULL)
    OR ("status" = 'WITHDRAWN' AND "withdrawnAt" IS NOT NULL AND "completedAt" IS NULL AND "completionMethod" IS NULL AND "completionVerifiedByUserId" IS NULL AND "completionVerifiedAt" IS NULL)
);

-- CreateIndex
CREATE INDEX "TrainingEnrollmentEvent_trainingEnrollmentId_idx" ON "TrainingEnrollmentEvent"("trainingEnrollmentId");

-- AddForeignKey
ALTER TABLE "TrainingProgram" ADD CONSTRAINT "TrainingProgram_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_programEnrollmentId_fkey" FOREIGN KEY ("programEnrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_trainingProgramId_fkey" FOREIGN KEY ("trainingProgramId") REFERENCES "TrainingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollmentEvent" ADD CONSTRAINT "TrainingEnrollmentEvent_trainingEnrollmentId_fkey" FOREIGN KEY ("trainingEnrollmentId") REFERENCES "TrainingEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
