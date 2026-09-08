ALTER TABLE "PurchaseRequest"
  ADD COLUMN "maintenanceId" TEXT,
  ADD COLUMN "directUse" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PurchaseRequest"
  ADD CONSTRAINT "PurchaseRequest_maintenanceId_fkey"
  FOREIGN KEY ("maintenanceId") REFERENCES "TruckMaintenance"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PurchaseRequest_maintenanceId_idx" ON "PurchaseRequest"("maintenanceId");
