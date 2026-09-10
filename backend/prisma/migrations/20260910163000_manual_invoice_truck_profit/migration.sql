ALTER TABLE "ManualInvoiceLine" ADD COLUMN "truckId" TEXT;

CREATE INDEX "ManualInvoiceLine_truckId_idx" ON "ManualInvoiceLine"("truckId");

ALTER TABLE "ManualInvoiceLine"
ADD CONSTRAINT "ManualInvoiceLine_truckId_fkey"
FOREIGN KEY ("truckId") REFERENCES "Truck"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
