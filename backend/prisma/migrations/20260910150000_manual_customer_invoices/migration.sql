ALTER TABLE "Invoice" ADD COLUMN "manualData" JSONB;

CREATE TABLE "ManualInvoiceLine" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "data" JSONB NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unit" TEXT,
  "rate" INTEGER NOT NULL DEFAULT 0,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManualInvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManualInvoiceLine_invoiceId_position_idx" ON "ManualInvoiceLine"("invoiceId", "position");
ALTER TABLE "ManualInvoiceLine" ADD CONSTRAINT "ManualInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
