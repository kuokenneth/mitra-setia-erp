CREATE TABLE "PurchaseOrderRequest" (
    "purchaseOrderId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderRequest_pkey" PRIMARY KEY ("purchaseOrderId", "requestId")
);

CREATE INDEX "PurchaseOrderRequest_requestId_idx" ON "PurchaseOrderRequest"("requestId");

ALTER TABLE "PurchaseOrderRequest"
ADD CONSTRAINT "PurchaseOrderRequest_purchaseOrderId_fkey"
FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderRequest"
ADD CONSTRAINT "PurchaseOrderRequest_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PurchaseOrderRequest" ("purchaseOrderId", "requestId", "createdAt")
SELECT "id", "requestId", "createdAt" FROM "PurchaseOrder"
ON CONFLICT ("purchaseOrderId", "requestId") DO NOTHING;

ALTER TABLE "PurchaseOrderItem" ADD COLUMN "purchaseRequestItemId" TEXT;

CREATE INDEX "PurchaseOrderItem_purchaseRequestItemId_idx" ON "PurchaseOrderItem"("purchaseRequestItemId");

ALTER TABLE "PurchaseOrderItem"
ADD CONSTRAINT "PurchaseOrderItem_purchaseRequestItemId_fkey"
FOREIGN KEY ("purchaseRequestItemId") REFERENCES "PurchaseRequestItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
