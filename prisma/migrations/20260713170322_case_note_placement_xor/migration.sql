-- AlterTable
ALTER TABLE "CaseNote" ADD COLUMN     "placementId" TEXT,
ALTER COLUMN "applicationId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CaseNoteRevision" (
    "id" TEXT NOT NULL,
    "caseNoteId" TEXT NOT NULL,
    "priorBody" TEXT NOT NULL,
    "editedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseNoteRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseNoteRevision_caseNoteId_idx" ON "CaseNoteRevision"("caseNoteId");

-- CreateIndex
CREATE INDEX "CaseNote_placementId_idx" ON "CaseNote"("placementId");

-- AddForeignKey
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNoteRevision" ADD CONSTRAINT "CaseNoteRevision_caseNoteId_fkey" FOREIGN KEY ("caseNoteId") REFERENCES "CaseNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- XOR ownership (database-design.md; Story 5.9 AC4): a case note belongs
-- to EXACTLY one owning context — Application or Placement, never both,
-- never neither. Hand-written: Prisma cannot express CHECK constraints.
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_owner_xor_check"
CHECK ((("applicationId" IS NOT NULL)::int + ("placementId" IS NOT NULL)::int) = 1);
