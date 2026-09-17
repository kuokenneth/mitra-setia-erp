CREATE TABLE "TruckPartStock" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitPrice" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TruckPartStock_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StockMovement" ADD COLUMN "fromTruckId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "toTruckId" TEXT;

CREATE UNIQUE INDEX "TruckPartStock_truckId_itemId_key" ON "TruckPartStock"("truckId", "itemId");
CREATE INDEX "TruckPartStock_itemId_qty_idx" ON "TruckPartStock"("itemId", "qty");
CREATE INDEX "StockMovement_fromTruckId_idx" ON "StockMovement"("fromTruckId");
CREATE INDEX "StockMovement_toTruckId_idx" ON "StockMovement"("toTruckId");

ALTER TABLE "TruckPartStock" ADD CONSTRAINT "TruckPartStock_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TruckPartStock" ADD CONSTRAINT "TruckPartStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_fromTruckId_fkey" FOREIGN KEY ("fromTruckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toTruckId_fkey" FOREIGN KEY ("toTruckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
