-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ELIGIBILITY_REVIEW', 'INTERVIEW', 'BACKGROUND_REVIEW', 'ACCEPTED', 'REJECTED', 'DISQUALIFIED');

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "motivation" TEXT,
    "workExperience" TEXT,
    "animalExperience" TEXT,
    "availabilityNotes" TEXT,
    "transportationNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_applicationNumber_key" ON "Application"("applicationNumber");

-- CreateIndex
CREATE INDEX "Application_personId_idx" ON "Application"("personId");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One non-terminal application per person (docs/architecture/database-design.md
-- partial-unique-index pattern; Story 2.3). Terminal statuses are excluded so
-- reapplication after REJECTED creates a new row without conflict.
CREATE UNIQUE INDEX "Application_one_active_per_person"
  ON "Application"("personId")
  WHERE "status" NOT IN ('ACCEPTED', 'REJECTED', 'DISQUALIFIED');
