CREATE TABLE "TruckMonthlyCost" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "depreciation" INTEGER NOT NULL DEFAULT 0,
    "insurance" INTEGER NOT NULL DEFAULT 0,
    "taxPermit" INTEGER NOT NULL DEFAULT 0,
    "driverSalary" INTEGER NOT NULL DEFAULT 0,
    "lease" INTEGER NOT NULL DEFAULT 0,
    "overhead" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TruckMonthlyCost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TruckMonthlyCost_truckId_month_key" ON "TruckMonthlyCost"("truckId", "month");
CREATE INDEX "TruckMonthlyCost_month_idx" ON "TruckMonthlyCost"("month");
ALTER TABLE "TruckMonthlyCost" ADD CONSTRAINT "TruckMonthlyCost_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
