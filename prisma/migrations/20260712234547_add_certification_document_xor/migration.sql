-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'CERTIFICATION';

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_applicationId_fkey";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "certificationId" TEXT,
ALTER COLUMN "applicationId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "issuedOn" DATE NOT NULL,
    "expiresOn" DATE,
    "requiredForMatching" BOOLEAN NOT NULL DEFAULT false,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Certification_participantId_idx" ON "Certification"("participantId");

-- CreateIndex
CREATE INDEX "Document_certificationId_idx" ON "Document"("certificationId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exactly one owning context per document (database-design.md): the XOR
-- expansion planned when Application was the only owner. Existing rows all
-- carry applicationId, so the constraint is immediately satisfiable.
ALTER TABLE "Document" ADD CONSTRAINT "Document_owner_xor_check"
CHECK (
  (("applicationId" IS NOT NULL)::int + ("certificationId" IS NOT NULL)::int) = 1
);

-- One ACTIVE supporting document per certification (mirrors the
-- one-ACTIVE-per-(application, type) rule from Story 2.4).
CREATE UNIQUE INDEX "Document_one_active_per_certification"
ON "Document"("certificationId")
WHERE "status" = 'ACTIVE' AND "certificationId" IS NOT NULL;
