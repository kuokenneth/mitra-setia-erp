CREATE TABLE "TripOperationalAction" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "warningCode" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "amount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "createdById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TripOperationalAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TripOperationalAction_tripId_idx" ON "TripOperationalAction"("tripId");
CREATE INDEX "TripOperationalAction_status_idx" ON "TripOperationalAction"("status");
CREATE INDEX "TripOperationalAction_assignedToId_idx" ON "TripOperationalAction"("assignedToId");
CREATE INDEX "TripOperationalAction_createdAt_idx" ON "TripOperationalAction"("createdAt");
ALTER TABLE "TripOperationalAction" ADD CONSTRAINT "TripOperationalAction_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripOperationalAction" ADD CONSTRAINT "TripOperationalAction_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TripOperationalAction" ADD CONSTRAINT "TripOperationalAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
