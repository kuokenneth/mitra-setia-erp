CREATE TABLE "SupplierBillRepairItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "SupplierBillRepairItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierBillRepairItem_movementId_key" ON "SupplierBillRepairItem"("movementId");
CREATE INDEX "SupplierBillRepairItem_billId_idx" ON "SupplierBillRepairItem"("billId");

ALTER TABLE "SupplierBillRepairItem" ADD CONSTRAINT "SupplierBillRepairItem_billId_fkey"
FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierBillRepairItem" ADD CONSTRAINT "SupplierBillRepairItem_movementId_fkey"
FOREIGN KEY ("movementId") REFERENCES "StockMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
