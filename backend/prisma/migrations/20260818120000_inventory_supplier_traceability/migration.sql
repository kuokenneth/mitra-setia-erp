CREATE TABLE "InventoryBatch" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "goodsReceiptId" TEXT,
  "goodsReceiptItemId" TEXT,
  "purchaseOrderItemId" TEXT,
  "receivedQty" DOUBLE PRECISION NOT NULL,
  "remainingQty" DOUBLE PRECISION,
  "unitPrice" INTEGER,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StockUnit" ADD COLUMN "inventoryBatchId" TEXT;
CREATE UNIQUE INDEX "InventoryBatch_goodsReceiptItemId_key" ON "InventoryBatch"("goodsReceiptItemId");
CREATE INDEX "InventoryBatch_itemId_locationId_remainingQty_idx" ON "InventoryBatch"("itemId", "locationId", "remainingQty");
CREATE INDEX "InventoryBatch_goodsReceiptId_idx" ON "InventoryBatch"("goodsReceiptId");
CREATE INDEX "InventoryBatch_purchaseOrderItemId_idx" ON "InventoryBatch"("purchaseOrderItemId");
CREATE INDEX "StockUnit_inventoryBatchId_idx" ON "StockUnit"("inventoryBatchId");
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_goodsReceiptItemId_fkey" FOREIGN KEY ("goodsReceiptItemId") REFERENCES "GoodsReceiptItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockUnit" ADD CONSTRAINT "StockUnit_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve the supplier/PO/GR trail for receipts created before this feature.
-- Remaining quantity is intentionally NULL because historic consumption cannot be allocated reliably.
INSERT INTO "InventoryBatch" (
  "id", "itemId", "locationId", "goodsReceiptId", "goodsReceiptItemId",
  "purchaseOrderItemId", "receivedQty", "remainingQty", "unitPrice", "receivedAt", "createdAt"
)
SELECT
  'legacy-' || gri."id", poi."itemId", gr."locationId", gr."id", gri."id",
  poi."id", gri."qty", NULL, poi."unitPrice", gr."receivedAt", gr."receivedAt"
FROM "GoodsReceiptItem" gri
JOIN "GoodsReceipt" gr ON gr."id" = gri."receiptId"
JOIN "PurchaseOrderItem" poi ON poi."id" = gri."purchaseOrderItemId";
