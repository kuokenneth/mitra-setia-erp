CREATE TABLE "MaterialStockReceipt" (
  "id" TEXT NOT NULL, "number" TEXT NOT NULL, "customerId" TEXT NOT NULL,
  "itemName" TEXT NOT NULL, "qtyReceived" DOUBLE PRECISION NOT NULL,
  "qtyRemaining" DOUBLE PRECISION NOT NULL, "unit" TEXT NOT NULL,
  "sourceName" TEXT, "deliveryNote" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locationId" TEXT, "proofUrl" TEXT NOT NULL, "proofFileName" TEXT,
  "proofMimeType" TEXT, "proofSize" INTEGER, "notes" TEXT,
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaterialStockReceipt_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MaterialStockAllocation" (
  "id" TEXT NOT NULL, "receiptId" TEXT NOT NULL, "materialInvoiceLineId" TEXT NOT NULL,
  "qty" DOUBLE PRECISION NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialStockAllocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaterialStockReceipt_number_key" ON "MaterialStockReceipt"("number");
CREATE INDEX "MaterialStockReceipt_customerId_itemName_unit_idx" ON "MaterialStockReceipt"("customerId","itemName","unit");
CREATE INDEX "MaterialStockReceipt_qtyRemaining_idx" ON "MaterialStockReceipt"("qtyRemaining");
CREATE INDEX "MaterialStockAllocation_receiptId_idx" ON "MaterialStockAllocation"("receiptId");
CREATE INDEX "MaterialStockAllocation_materialInvoiceLineId_idx" ON "MaterialStockAllocation"("materialInvoiceLineId");
ALTER TABLE "MaterialStockReceipt" ADD CONSTRAINT "MaterialStockReceipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialStockReceipt" ADD CONSTRAINT "MaterialStockReceipt_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "OperationalLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaterialStockReceipt" ADD CONSTRAINT "MaterialStockReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialStockAllocation" ADD CONSTRAINT "MaterialStockAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "MaterialStockReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialStockAllocation" ADD CONSTRAINT "MaterialStockAllocation_materialInvoiceLineId_fkey" FOREIGN KEY ("materialInvoiceLineId") REFERENCES "MaterialInvoiceLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
