CREATE TYPE "SupplierBillStatus" AS ENUM ('OPEN', 'WAITING_PAYMENT_APPROVAL', 'PARTIALLY_PAID', 'PAID', 'VOID');

CREATE TABLE "SupplierBill" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "amount" INTEGER NOT NULL,
    "notes" TEXT,
    "proofUrl" TEXT,
    "proofFileName" TEXT,
    "proofMimeType" TEXT,
    "proofSize" INTEGER,
    "status" "SupplierBillStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupplierBill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierBillReceipt" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "SupplierBillReceipt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PurchasePayment" ALTER COLUMN "purchaseOrderId" DROP NOT NULL;
ALTER TABLE "PurchasePayment" ADD COLUMN "supplierBillId" TEXT;

CREATE UNIQUE INDEX "SupplierBill_number_key" ON "SupplierBill"("number");
CREATE UNIQUE INDEX "SupplierBill_supplierId_invoiceNumber_key" ON "SupplierBill"("supplierId", "invoiceNumber");
CREATE INDEX "SupplierBill_supplierId_status_idx" ON "SupplierBill"("supplierId", "status");
CREATE UNIQUE INDEX "SupplierBillReceipt_receiptId_key" ON "SupplierBillReceipt"("receiptId");
CREATE INDEX "SupplierBillReceipt_billId_idx" ON "SupplierBillReceipt"("billId");
CREATE INDEX "PurchasePayment_supplierBillId_idx" ON "PurchasePayment"("supplierBillId");

ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierBillReceipt" ADD CONSTRAINT "SupplierBillReceipt_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierBillReceipt" ADD CONSTRAINT "SupplierBillReceipt_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "GoodsReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_supplierBillId_fkey" FOREIGN KEY ("supplierBillId") REFERENCES "SupplierBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
