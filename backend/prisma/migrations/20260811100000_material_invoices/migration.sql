CREATE TABLE "MaterialInvoice" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "materialName" TEXT NOT NULL,
  "qty" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "proofUrl" TEXT,
  "proofFileName" TEXT,
  "proofMimeType" TEXT,
  "proofSize" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaterialInvoice_orderId_number_key" ON "MaterialInvoice"("orderId", "number");
CREATE INDEX "MaterialInvoice_orderId_idx" ON "MaterialInvoice"("orderId");
CREATE INDEX "MaterialInvoice_tripId_idx" ON "MaterialInvoice"("tripId");
ALTER TABLE "MaterialInvoice" ADD CONSTRAINT "MaterialInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialInvoice" ADD CONSTRAINT "MaterialInvoice_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
