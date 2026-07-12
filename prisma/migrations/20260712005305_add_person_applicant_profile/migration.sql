-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalFirstName" TEXT NOT NULL,
    "legalLastName" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicantProfile" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "mailingAddressLine1" TEXT NOT NULL,
    "mailingAddressLine2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_userId_key" ON "Person"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicantProfile_personId_key" ON "ApplicantProfile"("personId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantProfile" ADD CONSTRAINT "ApplicantProfile_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
