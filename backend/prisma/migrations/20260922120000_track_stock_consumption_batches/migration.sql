CREATE TABLE "StockMovementBatchAllocation" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StockMovementBatchAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockMovementBatchAllocation_movementId_batchId_key"
ON "StockMovementBatchAllocation"("movementId", "batchId");

CREATE INDEX "StockMovementBatchAllocation_batchId_idx"
ON "StockMovementBatchAllocation"("batchId");

ALTER TABLE "StockMovementBatchAllocation"
ADD CONSTRAINT "StockMovementBatchAllocation_movementId_fkey"
FOREIGN KEY ("movementId") REFERENCES "StockMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockMovementBatchAllocation"
ADD CONSTRAINT "StockMovementBatchAllocation_batchId_fkey"
FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
