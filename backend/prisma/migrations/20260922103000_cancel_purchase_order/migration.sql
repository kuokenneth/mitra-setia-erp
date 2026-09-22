ALTER TYPE "PurchaseOrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "PurchaseOrder"
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "cancelledById" TEXT;

CREATE INDEX "PurchaseOrder_cancelledById_idx" ON "PurchaseOrder"("cancelledById");

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
