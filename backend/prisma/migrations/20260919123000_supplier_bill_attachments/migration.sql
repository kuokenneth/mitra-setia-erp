CREATE TABLE "SupplierBillAttachment" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierBillAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupplierBillAttachment_billId_idx" ON "SupplierBillAttachment"("billId");

ALTER TABLE "SupplierBillAttachment"
ADD CONSTRAINT "SupplierBillAttachment_billId_fkey"
FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
