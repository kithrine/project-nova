-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "detail" TEXT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "disqualifiedAt" TIMESTAMP(3);
