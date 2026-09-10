ALTER TYPE "StockUnitStatus" ADD VALUE 'REPAIRING';

CREATE TABLE "PartRepair" (
  "id" TEXT NOT NULL,
  "stockUnitId" TEXT NOT NULL,
  "supplierId" TEXT,
  "status" "RetreadStatus" NOT NULL DEFAULT 'SENT',
  "cost" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "maintenanceId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartRepair_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PurchaseRequestItem" ADD COLUMN "partRepairId" TEXT;
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "partRepairId" TEXT;

CREATE INDEX "PartRepair_stockUnitId_idx" ON "PartRepair"("stockUnitId");
CREATE INDEX "PartRepair_supplierId_idx" ON "PartRepair"("supplierId");
CREATE INDEX "PartRepair_maintenanceId_idx" ON "PartRepair"("maintenanceId");
CREATE INDEX "PartRepair_status_idx" ON "PartRepair"("status");
CREATE INDEX "PurchaseRequestItem_partRepairId_idx" ON "PurchaseRequestItem"("partRepairId");
CREATE INDEX "PurchaseOrderItem_partRepairId_idx" ON "PurchaseOrderItem"("partRepairId");

ALTER TABLE "PartRepair" ADD CONSTRAINT "PartRepair_stockUnitId_fkey" FOREIGN KEY ("stockUnitId") REFERENCES "StockUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartRepair" ADD CONSTRAINT "PartRepair_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartRepair" ADD CONSTRAINT "PartRepair_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "TruckMaintenance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartRepair" ADD CONSTRAINT "PartRepair_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_partRepairId_fkey" FOREIGN KEY ("partRepairId") REFERENCES "PartRepair"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_partRepairId_fkey" FOREIGN KEY ("partRepairId") REFERENCES "PartRepair"("id") ON DELETE SET NULL ON UPDATE CASCADE;
