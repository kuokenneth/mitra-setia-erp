-- Manual revenue entries used by the fleet profitability report.
CREATE TABLE "TruckManualRevenue" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "revenueDate" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruckManualRevenue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TruckManualRevenue_truckId_revenueDate_idx" ON "TruckManualRevenue"("truckId", "revenueDate");
CREATE INDEX "TruckManualRevenue_createdById_idx" ON "TruckManualRevenue"("createdById");

ALTER TABLE "TruckManualRevenue" ADD CONSTRAINT "TruckManualRevenue_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TruckManualRevenue" ADD CONSTRAINT "TruckManualRevenue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
