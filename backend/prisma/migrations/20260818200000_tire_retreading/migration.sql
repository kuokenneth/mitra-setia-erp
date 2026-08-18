ALTER TYPE "StockUnitStatus" ADD VALUE 'RETREADING';

CREATE TYPE "RetreadStatus" AS ENUM ('SENT', 'COMPLETED', 'CANCELLED');

ALTER TABLE "StockUnit"
ADD COLUMN "retreadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastRetreadAt" TIMESTAMP(3),
ADD COLUMN "totalRetreadCost" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "TireRetread" (
  "id" TEXT NOT NULL,
  "stockUnitId" TEXT NOT NULL,
  "fromItemId" TEXT NOT NULL,
  "toItemId" TEXT NOT NULL,
  "supplierId" TEXT,
  "status" "RetreadStatus" NOT NULL DEFAULT 'SENT',
  "cost" INTEGER NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TireRetread_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TireRetread_stockUnitId_idx" ON "TireRetread"("stockUnitId");
CREATE INDEX "TireRetread_supplierId_idx" ON "TireRetread"("supplierId");
CREATE INDEX "TireRetread_status_idx" ON "TireRetread"("status");

ALTER TABLE "TireRetread" ADD CONSTRAINT "TireRetread_stockUnitId_fkey" FOREIGN KEY ("stockUnitId") REFERENCES "StockUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TireRetread" ADD CONSTRAINT "TireRetread_fromItemId_fkey" FOREIGN KEY ("fromItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TireRetread" ADD CONSTRAINT "TireRetread_toItemId_fkey" FOREIGN KEY ("toItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TireRetread" ADD CONSTRAINT "TireRetread_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TireRetread" ADD CONSTRAINT "TireRetread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
