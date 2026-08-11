CREATE TABLE "MaterialInvoiceLine" (
  "id" TEXT NOT NULL,
  "materialInvoiceId" TEXT NOT NULL,
  "ppNumber" TEXT,
  "poNumber" TEXT,
  "itemName" TEXT NOT NULL,
  "qty" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "totalKg" DOUBLE PRECISION,
  "totalAmount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialInvoiceLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaterialInvoiceLine_materialInvoiceId_idx" ON "MaterialInvoiceLine"("materialInvoiceId");
ALTER TABLE "MaterialInvoiceLine" ADD CONSTRAINT "MaterialInvoiceLine_materialInvoiceId_fkey" FOREIGN KEY ("materialInvoiceId") REFERENCES "MaterialInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
