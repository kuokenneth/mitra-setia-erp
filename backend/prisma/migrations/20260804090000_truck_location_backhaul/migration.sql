ALTER TYPE "TruckStatus" ADD VALUE IF NOT EXISTS 'WAITING_BACKHAUL';
ALTER TYPE "TruckStatus" ADD VALUE IF NOT EXISTS 'RETURNING_EMPTY';

ALTER TABLE "Truck"
ADD COLUMN "baseLocation" TEXT,
ADD COLUMN "currentLocation" TEXT,
ADD COLUMN "locationUpdatedAt" TIMESTAMP(3),
ADD COLUMN "availableForBackhaul" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "idleSince" TIMESTAMP(3);

CREATE INDEX "Truck_currentLocation_idx" ON "Truck"("currentLocation");
CREATE INDEX "Truck_availableForBackhaul_idx" ON "Truck"("availableForBackhaul");
