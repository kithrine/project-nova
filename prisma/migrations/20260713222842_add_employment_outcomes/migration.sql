-- CreateTable
CREATE TABLE "EmploymentOutcome" (
    "id" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "hiredOn" DATE NOT NULL,
    "employerName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmploymentOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentOutcome_placementId_key" ON "EmploymentOutcome"("placementId");

-- CreateIndex
CREATE INDEX "EmploymentOutcome_participantId_idx" ON "EmploymentOutcome"("participantId");

-- AddForeignKey
ALTER TABLE "EmploymentOutcome" ADD CONSTRAINT "EmploymentOutcome_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentOutcome" ADD CONSTRAINT "EmploymentOutcome_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
