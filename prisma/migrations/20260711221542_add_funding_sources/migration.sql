-- CreateEnum
CREATE TYPE "FundingSourceKind" AS ENUM ('GRANT', 'CONTRACT', 'OTHER');

-- CreateTable
CREATE TABLE "FundingSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FundingSourceKind" NOT NULL,
    "code" TEXT,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE,
    "endDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingSource_pkey" PRIMARY KEY ("id")
);
