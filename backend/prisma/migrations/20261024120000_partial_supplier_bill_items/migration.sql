DROP INDEX IF EXISTS "SupplierBillItem_receiptItemId_key";

CREATE INDEX IF NOT EXISTS "SupplierBillItem_receiptItemId_idx"
ON "SupplierBillItem"("receiptItemId");
