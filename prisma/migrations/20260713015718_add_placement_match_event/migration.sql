-- CreateTable
CREATE TABLE "PlacementMatchEvent" (
    "id" TEXT NOT NULL,
    "placementMatchId" TEXT NOT NULL,
    "fromStatus" "MatchStatus",
    "toStatus" "MatchStatus" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementMatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlacementMatchEvent_placementMatchId_idx" ON "PlacementMatchEvent"("placementMatchId");

-- AddForeignKey
ALTER TABLE "PlacementMatchEvent" ADD CONSTRAINT "PlacementMatchEvent_placementMatchId_fkey" FOREIGN KEY ("placementMatchId") REFERENCES "PlacementMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
