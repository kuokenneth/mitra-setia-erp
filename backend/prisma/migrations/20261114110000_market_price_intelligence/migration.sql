BEGIN;
-- CreateTable
CREATE TABLE "MarketPriceMonitor" (
    "itemId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalDays" INTEGER NOT NULL DEFAULT 7,
    "staleDays" INTEGER NOT NULL DEFAULT 14,
    "expectedBrand" TEXT,
    "expectedPartNumber" TEXT,
    "productType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "specifications" TEXT,
    "vehicleCompatibility" TEXT,
    "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPriceMonitor_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "MarketProductListing" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MANUAL',
    "url" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedIdentity" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketProductListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPriceSnapshot" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "shippingCost" DECIMAL(18,2),
    "packSize" DECIMAL(18,3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "unit" TEXT NOT NULL,
    "taxBasis" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "availability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "matchConfidence" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "data" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPriceQuotation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "reference" TEXT,
    "brand" TEXT,
    "partNumber" TEXT,
    "productType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "specifications" TEXT,
    "vehicleCompatibility" TEXT,
    "unit" TEXT NOT NULL,
    "packSize" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "minimumOrderQty" DECIMAL(18,3) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "shippingCost" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "taxBasis" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "quotedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "proof" JSONB,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPriceQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPriceCheckJob" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "activeKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockToken" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "requestedById" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "logs" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPriceCheckJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketPriceMonitor_enabled_nextCheckAt_idx" ON "MarketPriceMonitor"("enabled", "nextCheckAt");

-- CreateIndex
CREATE INDEX "MarketProductListing_itemId_source_reviewStatus_idx" ON "MarketProductListing"("itemId", "source", "reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MarketProductListing_itemId_urlHash_key" ON "MarketProductListing"("itemId", "urlHash");

-- CreateIndex
CREATE INDEX "MarketPriceSnapshot_listingId_observedAt_recordedAt_idx" ON "MarketPriceSnapshot"("listingId", "observedAt", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPriceSnapshot_listingId_eventKey_key" ON "MarketPriceSnapshot"("listingId", "eventKey");

-- CreateIndex
CREATE INDEX "SupplierPriceQuotation_itemId_status_expiresAt_idx" ON "SupplierPriceQuotation"("itemId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "SupplierPriceQuotation_supplierId_quotedAt_idx" ON "SupplierPriceQuotation"("supplierId", "quotedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketPriceCheckJob_activeKey_key" ON "MarketPriceCheckJob"("activeKey");

-- CreateIndex
CREATE INDEX "MarketPriceCheckJob_status_availableAt_idx" ON "MarketPriceCheckJob"("status", "availableAt");

-- CreateIndex
CREATE INDEX "MarketPriceCheckJob_itemId_createdAt_idx" ON "MarketPriceCheckJob"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketPriceMonitor" ADD CONSTRAINT "MarketPriceMonitor_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketProductListing" ADD CONSTRAINT "MarketProductListing_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPriceSnapshot" ADD CONSTRAINT "MarketPriceSnapshot_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketProductListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPriceQuotation" ADD CONSTRAINT "SupplierPriceQuotation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPriceQuotation" ADD CONSTRAINT "SupplierPriceQuotation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPriceCheckJob" ADD CONSTRAINT "MarketPriceCheckJob_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Guard monetary and scheduling invariants even outside the HTTP API.
ALTER TABLE "MarketPriceMonitor" ADD CONSTRAINT "MarketPriceMonitor_interval_check" CHECK ("intervalDays" BETWEEN 1 AND 90 AND "staleDays" BETWEEN 1 AND 90);
ALTER TABLE "MarketPriceSnapshot" ADD CONSTRAINT "MarketPriceSnapshot_amount_check" CHECK (price > 0 AND "packSize" > 0 AND ("shippingCost" IS NULL OR "shippingCost" >= 0));
ALTER TABLE "SupplierPriceQuotation" ADD CONSTRAINT "SupplierPriceQuotation_amount_check" CHECK ("unitPrice" > 0 AND "packSize" > 0 AND quantity > 0 AND "minimumOrderQty" > 0 AND quantity >= "minimumOrderQty" AND discount >= 0 AND discount < "unitPrice" * quantity AND ("shippingCost" IS NULL OR "shippingCost" >= 0) AND "expiresAt" >= "quotedAt");
ALTER TABLE "MarketPriceCheckJob" ADD CONSTRAINT "MarketPriceCheckJob_attempts_check" CHECK (attempts BETWEEN 0 AND 3);
COMMIT;
