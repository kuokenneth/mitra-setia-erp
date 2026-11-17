ALTER TYPE "StockUnitStatus" ADD VALUE IF NOT EXISTS 'RETURNED_TO_SUPPLIER';
ALTER TABLE "GoodsReceiptItem" ADD COLUMN "returnedQty" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SupplierBillItem" ADD COLUMN "returnedQty" DOUBLE PRECISION NOT NULL DEFAULT 0, ADD COLUMN "returnedAmount" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "PurchaseReturn" (
 "id" TEXT NOT NULL PRIMARY KEY, "number" TEXT NOT NULL, "supplierId" TEXT NOT NULL,
 "returnDate" TIMESTAMP(3) NOT NULL, "reason" TEXT NOT NULL, "notes" TEXT,
 "proofUrl" TEXT NOT NULL, "proofFileName" TEXT, "proofMimeType" TEXT NOT NULL,
 "totalAmount" INTEGER NOT NULL, "creditAmount" INTEGER NOT NULL DEFAULT 0,
 "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PurchaseReturn_number_key" ON "PurchaseReturn"("number");
CREATE INDEX "PurchaseReturn_supplierId_returnDate_idx" ON "PurchaseReturn"("supplierId", "returnDate");
CREATE TABLE "PurchaseReturnItem" (
 "id" TEXT NOT NULL PRIMARY KEY, "returnId" TEXT NOT NULL, "receiptItemId" TEXT NOT NULL,
 "qty" DOUBLE PRECISION NOT NULL, "unitPrice" DOUBLE PRECISION NOT NULL, "amount" INTEGER NOT NULL,
 "stockUnitIds" JSONB NOT NULL, "billAdjustments" JSONB NOT NULL,
 CONSTRAINT "PurchaseReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "PurchaseReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PurchaseReturnItem_receiptItemId_fkey" FOREIGN KEY ("receiptItemId") REFERENCES "GoodsReceiptItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PurchaseReturnItem_receiptItemId_idx" ON "PurchaseReturnItem"("receiptItemId");
