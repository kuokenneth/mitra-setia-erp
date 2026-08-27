ALTER TABLE "PurchaseRequestItem" ADD COLUMN "tireRetreadId" TEXT;
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "tireRetreadId" TEXT;

CREATE INDEX "PurchaseRequestItem_tireRetreadId_idx" ON "PurchaseRequestItem"("tireRetreadId");
CREATE INDEX "PurchaseOrderItem_tireRetreadId_idx" ON "PurchaseOrderItem"("tireRetreadId");

ALTER TABLE "PurchaseRequestItem"
ADD CONSTRAINT "PurchaseRequestItem_tireRetreadId_fkey"
FOREIGN KEY ("tireRetreadId") REFERENCES "TireRetread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem"
ADD CONSTRAINT "PurchaseOrderItem_tireRetreadId_fkey"
FOREIGN KEY ("tireRetreadId") REFERENCES "TireRetread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
