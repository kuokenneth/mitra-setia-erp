CREATE TABLE "MaintenanceNote" (
  "id" TEXT NOT NULL,
  "maintenanceId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceNote_maintenanceId_idx" ON "MaintenanceNote"("maintenanceId");
CREATE INDEX "MaintenanceNote_createdAt_idx" ON "MaintenanceNote"("createdAt");

ALTER TABLE "MaintenanceNote" ADD CONSTRAINT "MaintenanceNote_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "TruckMaintenance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceNote" ADD CONSTRAINT "MaintenanceNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
