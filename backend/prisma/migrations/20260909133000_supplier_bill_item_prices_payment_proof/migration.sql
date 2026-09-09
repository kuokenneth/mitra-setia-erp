ALTER TABLE "PurchasePayment"
ADD COLUMN "proofUrl" TEXT,
ADD COLUMN "proofFileName" TEXT,
ADD COLUMN "proofMimeType" TEXT,
ADD COLUMN "proofSize" INTEGER;

CREATE TABLE "SupplierBillItem" (
  "id" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "receiptItemId" TEXT NOT NULL,
  "qty" DOUBLE PRECISION NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  CONSTRAINT "SupplierBillItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierBillItem_receiptItemId_key" ON "SupplierBillItem"("receiptItemId");
CREATE INDEX "SupplierBillItem_billId_idx" ON "SupplierBillItem"("billId");
ALTER TABLE "SupplierBillItem" ADD CONSTRAINT "SupplierBillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierBillItem" ADD CONSTRAINT "SupplierBillItem_receiptItemId_fkey" FOREIGN KEY ("receiptItemId") REFERENCES "GoodsReceiptItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
