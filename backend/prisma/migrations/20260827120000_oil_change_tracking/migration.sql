ALTER TYPE "ItemCategory" ADD VALUE IF NOT EXISTS 'OIL';

ALTER TABLE "TruckMaintenance"
ADD COLUMN "isOilChange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "oilChangedAt" TIMESTAMP(3);

CREATE INDEX "TruckMaintenance_truckId_isOilChange_oilChangedAt_idx"
ON "TruckMaintenance"("truckId", "isOilChange", "oilChangedAt");

ALTER TABLE "StockMovement"
ADD COLUMN "unitPrice" INTEGER,
ADD COLUMN "totalCost" INTEGER;
