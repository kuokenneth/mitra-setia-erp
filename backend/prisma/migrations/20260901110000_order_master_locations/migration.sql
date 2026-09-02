ALTER TABLE "Order"
ADD COLUMN "pickupLocationId" TEXT,
ADD COLUMN "destinationLocationId" TEXT;

CREATE INDEX "Order_pickupLocationId_idx" ON "Order"("pickupLocationId");
CREATE INDEX "Order_destinationLocationId_idx" ON "Order"("destinationLocationId");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_pickupLocationId_fkey"
FOREIGN KEY ("pickupLocationId") REFERENCES "OperationalLocation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_destinationLocationId_fkey"
FOREIGN KEY ("destinationLocationId") REFERENCES "OperationalLocation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
