ALTER TABLE "Trip" ADD COLUMN "billingCustomerName" TEXT;

CREATE TABLE "SingleTripInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "actualWeightKg" DOUBLE PRECISION NOT NULL,
    "ratePerKg" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SingleTripInvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SingleTripInvoiceLine_tripId_key" ON "SingleTripInvoiceLine"("tripId");
CREATE INDEX "SingleTripInvoiceLine_invoiceId_idx" ON "SingleTripInvoiceLine"("invoiceId");
ALTER TABLE "SingleTripInvoiceLine" ADD CONSTRAINT "SingleTripInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SingleTripInvoiceLine" ADD CONSTRAINT "SingleTripInvoiceLine_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
