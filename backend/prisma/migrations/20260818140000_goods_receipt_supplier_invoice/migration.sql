ALTER TABLE "GoodsReceipt"
ADD COLUMN "supplierInvoiceNumber" TEXT,
ADD COLUMN "supplierInvoiceDate" TIMESTAMP(3),
ADD COLUMN "supplierInvoiceAmount" INTEGER,
ADD COLUMN "supplierInvoiceProofUrl" TEXT,
ADD COLUMN "supplierInvoiceFileName" TEXT,
ADD COLUMN "supplierInvoiceMimeType" TEXT,
ADD COLUMN "supplierInvoiceSize" INTEGER;
