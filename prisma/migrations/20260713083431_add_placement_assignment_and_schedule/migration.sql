-- CreateEnum
CREATE TYPE "ScheduleDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- AlterTable
ALTER TABLE "Placement" ADD COLUMN     "coordinatorUserId" TEXT,
ADD COLUMN     "shelterReviewNote" TEXT;

-- AlterTable
ALTER TABLE "PlacementEvent" ADD COLUMN     "detail" TEXT;

-- CreateTable
CREATE TABLE "PlacementSchedule" (
    "id" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "weeklyHoursTarget" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlacementSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementScheduleDay" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "day" "ScheduleDay" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "PlacementScheduleDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlacementSchedule_placementId_key" ON "PlacementSchedule"("placementId");

-- CreateIndex
CREATE UNIQUE INDEX "PlacementScheduleDay_scheduleId_day_key" ON "PlacementScheduleDay"("scheduleId", "day");

-- AddForeignKey
ALTER TABLE "PlacementSchedule" ADD CONSTRAINT "PlacementSchedule_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementScheduleDay" ADD CONSTRAINT "PlacementScheduleDay_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "PlacementSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
