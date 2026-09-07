ALTER TABLE "MaterialInvoice"
ADD COLUMN "destinationLocationId" TEXT,
ADD COLUMN "stopSequence" INTEGER,
ADD COLUMN "destinationArrivedAt" TIMESTAMP(3),
ADD COLUMN "destinationCompletedAt" TIMESTAMP(3);

CREATE INDEX "MaterialInvoice_destinationLocationId_idx" ON "MaterialInvoice"("destinationLocationId");
ALTER TABLE "MaterialInvoice" ADD CONSTRAINT "MaterialInvoice_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "OperationalLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
