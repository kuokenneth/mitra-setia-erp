ALTER TYPE "TripPhase" ADD VALUE IF NOT EXISTS 'SERVICE_AT_BASE';

ALTER TABLE "Trip"
ADD COLUMN "serviceCandidateAt" TIMESTAMP(3),
ADD COLUMN "serviceCandidateBaseId" TEXT;

CREATE TABLE "TripServiceStop" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "locationId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "autoDetected" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripServiceStop_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TripServiceStop_tripId_idx" ON "TripServiceStop"("tripId");
CREATE INDEX "TripServiceStop_locationId_idx" ON "TripServiceStop"("locationId");
CREATE INDEX "TripServiceStop_endedAt_idx" ON "TripServiceStop"("endedAt");

ALTER TABLE "TripServiceStop"
ADD CONSTRAINT "TripServiceStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TripServiceStop"
ADD CONSTRAINT "TripServiceStop_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "OperationalLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
