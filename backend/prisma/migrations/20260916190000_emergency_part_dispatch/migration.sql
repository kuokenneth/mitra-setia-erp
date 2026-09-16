ALTER TYPE "StockUnitStatus" ADD VALUE IF NOT EXISTS 'IN_TRANSIT';

CREATE TYPE "EmergencyPartDispatchStatus" AS ENUM ('IN_TRANSIT', 'INSTALLED', 'CANCELLED');

CREATE TABLE "EmergencyPartDispatch" (
  "id" TEXT NOT NULL,
  "status" "EmergencyPartDispatchStatus" NOT NULL DEFAULT 'IN_TRANSIT',
  "targetTruckId" TEXT NOT NULL,
  "carrierTruckId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "stockUnitId" TEXT,
  "fromLocationId" TEXT NOT NULL,
  "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "damageProofUrl" TEXT NOT NULL,
  "damageProofFileName" TEXT,
  "damageProofMimeType" TEXT,
  "installProofUrl" TEXT,
  "installProofFileName" TEXT,
  "installProofMimeType" TEXT,
  "oldStockUnitId" TEXT,
  "oldPartDisposition" TEXT,
  "note" TEXT,
  "createdById" TEXT,
  "installedById" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "installedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyPartDispatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmergencyPartDispatch_status_idx" ON "EmergencyPartDispatch"("status");
CREATE INDEX "EmergencyPartDispatch_targetTruckId_idx" ON "EmergencyPartDispatch"("targetTruckId");
CREATE INDEX "EmergencyPartDispatch_carrierTruckId_idx" ON "EmergencyPartDispatch"("carrierTruckId");
CREATE INDEX "EmergencyPartDispatch_itemId_idx" ON "EmergencyPartDispatch"("itemId");
CREATE INDEX "EmergencyPartDispatch_stockUnitId_idx" ON "EmergencyPartDispatch"("stockUnitId");
CREATE INDEX "EmergencyPartDispatch_sentAt_idx" ON "EmergencyPartDispatch"("sentAt");
