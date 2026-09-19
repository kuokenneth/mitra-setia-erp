DROP INDEX IF EXISTS "SupplierBillReceipt_receiptId_key";

CREATE UNIQUE INDEX "SupplierBillReceipt_billId_receiptId_key"
ON "SupplierBillReceipt"("billId", "receiptId");
